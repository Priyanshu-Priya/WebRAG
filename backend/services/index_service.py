import logging
from datetime import datetime
from typing import Callable, Awaitable, Optional, List
from sqlalchemy.orm import Session

from backend.database.models import Collection, Page, Chunk, Change, URL
from backend.crawler.crawler import WebCrawler
from backend.parser.cleaner import HTMLCleaner, Chunker, get_text_hash
from backend.rag.chroma_manager import ChromaManager
from backend.services.change_detector import ChangeDetector
from backend.config.config import settings

logger = logging.getLogger(__name__)

class IndexingService:
    def __init__(self):
        self.chroma_manager = ChromaManager()

    async def index_collection(
        self,
        collection_id: int,
        db: Session,
        websocket_callback: Optional[Callable[[dict], Awaitable[None]]] = None
    ) -> bool:
        """
        Orchestrates the crawler, processes page content, checks hashes for updates,
        triggers change detection, updates SQLite and ChromaDB, and reports progress.
        """
        async def send_update(event_type: str, message: str, extra: dict = None):
            if websocket_callback:
                payload = {"collection_id": collection_id, "type": event_type, "message": message}
                if extra:
                    payload.update(extra)
                await websocket_callback(payload)
            logger.info(f"[Collection {collection_id}] {message}")

        # 1. Load collection and seed URLs
        collection = db.query(Collection).filter(Collection.id == collection_id).first()
        if not collection:
            logger.error(f"Collection {collection_id} not found.")
            return False

        urls = db.query(URL).filter(URL.collection_id == collection_id).all()
        seed_urls = [u.url for u in urls]

        if not seed_urls:
            collection.status = "Failed"
            db.commit()
            await send_update("error", "No seed URLs configured in this collection.")
            return False

        collection.status = "Indexing"
        db.commit()
        await send_update("info", "Starting crawler session...")

        # Get settings configuration
        # For simplicity, load crawl settings from database/settings if present, else use env defaults
        max_depth = settings.CRAWL_MAX_DEPTH
        max_pages = settings.CRAWL_MAX_PAGES
        
        crawler = WebCrawler(
            max_depth=max_depth,
            max_pages=max_pages,
            user_agent=settings.CRAWL_USER_AGENT
        )

        success = True
        try:
            # 2. Iterate through crawled pages yield
            async for event in crawler.crawl(seed_urls):
                if event["event"] == "progress":
                    status = event.get("status")
                    msg = event.get("message", "")
                    current = event.get("current", 0)
                    
                    if status == "completed":
                        await send_update("info", msg, {"progress": 100, "current_page": current})
                    else:
                        # Estimate crawler progress based on max_pages
                        pct = int((current / max_pages) * 90) # Save last 10% for embedding generation
                        await send_update("progress", msg, {"progress": pct, "current_page": current})

                elif event["event"] == "error":
                    await send_update("warning", event.get("message", ""))

                elif event["event"] == "page":
                    url = event["url"]
                    html = event["html"]
                    etag = event["etag"]
                    last_modified = event["last_modified"]

                    await send_update("info", f"Parsing and cleaning HTML: {url}")
                    
                    clean_text = HTMLCleaner.clean(html)
                    title = HTMLCleaner.extract_title(html)
                    new_hash = get_text_hash(clean_text)

                    # Check if page is empty
                    if not clean_text.strip():
                        await send_update("warning", f"Page clean text was empty, skipping indexing for: {url}")
                        continue

                    # Query database for existing page
                    existing_page = db.query(Page).filter(
                        Page.collection_id == collection_id,
                        Page.url == url
                    ).first()

                    if not existing_page:
                        # Case A: Totally New Page
                        await send_update("info", f"New page detected. Adding to indexes: {url}")
                        
                        db_page = Page(
                            collection_id=collection_id,
                            url=url,
                            title=title,
                            content_hash=new_hash,
                            etag=etag,
                            last_modified=last_modified,
                            indexed_time=datetime.utcnow()
                        )
                        db.add(db_page)
                        db.commit() # Commit to generate db_page.id

                        # Generate chunks & save
                        chunks = Chunker.chunk_text(
                            clean_text, 
                            metadata_base={"url": url, "title": title, "timestamp": str(datetime.utcnow())}
                        )
                        
                        # Add to vector database
                        await send_update("info", f"Generating embeddings and saving vectors for {len(chunks)} chunks...")
                        self.chroma_manager.add_chunks(collection_id, chunks)

                        # Save chunk metadata to relational database
                        for chunk in chunks:
                            db_chunk = Chunk(
                                page_id=db_page.id,
                                chunk_index=chunk["chunk_index"],
                                content=chunk["content"],
                                chunk_hash=chunk["chunk_hash"]
                            )
                            db.add(db_chunk)
                        
                        db.commit()

                    else:
                        # Case B: Exists. Check if content has changed via hash
                        if existing_page.content_hash != new_hash:
                            await send_update("info", f"Content change detected on: {url}. Re-indexing page...")

                            # 1. Run Change Detection
                            # Extract old text content from database chunks
                            old_chunks = db.query(Chunk).filter(Chunk.page_id == existing_page.id).order_by(Chunk.chunk_index).all()
                            old_text = ". ".join([oc.content for oc in old_chunks])

                            # Detect diff
                            diff_report = ChangeDetector.detect_changes(old_text, clean_text)
                            
                            # Log the change report in database
                            change_log = Change(
                                collection_id=collection_id,
                                page_url=url,
                                sections_added=diff_report["sections_added"],
                                sections_removed=diff_report["sections_removed"],
                                paragraphs_changed=diff_report["paragraphs_changed"],
                                report_text=diff_report["report_text"],
                                timestamp=datetime.utcnow()
                            )
                            db.add(change_log)

                            # 2. Re-index vectors: Delete old chunks from ChromaDB
                            self.chroma_manager.delete_page_chunks(collection_id, url)

                            # 3. Clean old relational database chunks
                            db.query(Chunk).filter(Chunk.page_id == existing_page.id).delete()
                            db.commit()

                            # 4. Save new chunks
                            chunks = Chunker.chunk_text(
                                clean_text,
                                metadata_base={"url": url, "title": title, "timestamp": str(datetime.utcnow())}
                            )
                            self.chroma_manager.add_chunks(collection_id, chunks)

                            for chunk in chunks:
                                db_chunk = Chunk(
                                    page_id=existing_page.id,
                                    chunk_index=chunk["chunk_index"],
                                    content=chunk["content"],
                                    chunk_hash=chunk["chunk_hash"]
                                )
                                db.add(db_chunk)

                            # Update page metadata
                            existing_page.title = title
                            existing_page.content_hash = new_hash
                            existing_page.etag = etag
                            existing_page.last_modified = last_modified
                            existing_page.indexed_time = datetime.utcnow()
                            db.commit()

                            await send_update(
                                "info", 
                                f"Re-indexed {url} successfully. Diff stats: "
                                f"+{diff_report['sections_added']} added, "
                                f"-{diff_report['sections_removed']} removed, "
                                f"~{diff_report['paragraphs_changed']} modified."
                            )
                        else:
                            # Case C: Unchanged Page
                            await send_update("info", f"Page content is up-to-date (hash match), skipping: {url}")
                            existing_page.indexed_time = datetime.utcnow()
                            db.commit()

            # Mark collection as Ready
            collection.status = "Ready"
            collection.last_indexed = datetime.utcnow()
            db.commit()
            await send_update("completed", "Collection indexing completed successfully.", {"progress": 100})

        except Exception as e:
            logger.exception(f"Error during collection {collection_id} indexing: {e}")
            collection.status = "Failed"
            db.commit()
            await send_update("error", f"Indexing failed: {str(e)}")
            success = False

        return success

import logging
import chromadb
from typing import List, Dict, Any, Tuple
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from backend.config.config import settings
from backend.embeddings.embeddings_manager import get_embeddings

logger = logging.getLogger(__name__)

# Single persistent client to avoid locking SQLite/Chroma state files
_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        logger.info(f"Initializing persistent Chroma client at {settings.CHROMA_DB_DIR}")
        _chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
    return _chroma_client


class ChromaManager:
    def __init__(self):
        self.client = get_chroma_client()
        self.embeddings = get_embeddings()

    def _get_collection_name(self, collection_id: int) -> str:
        """Standardizes naming to prevent Chroma collection name conflicts."""
        return f"collection_id_{collection_id}"

    def get_vector_store(self, collection_id: int) -> Chroma:
        """Returns the LangChain wrapper for Chroma vector store."""
        collection_name = self._get_collection_name(collection_id)
        return Chroma(
            client=self.client,
            collection_name=collection_name,
            embedding_function=self.embeddings
        )

    def add_chunks(self, collection_id: int, chunks: List[Dict[str, Any]]):
        """
        Embeds and stores text chunks.
        chunks schema should contain:
            - content: text content of the chunk
            - url: source page url
            - title: source page title
            - chunk_index: index integer
            - chunk_hash: SHA256 of text
        """
        if not chunks:
            return

        vector_store = self.get_vector_store(collection_id)
        
        texts = [c["content"] for c in chunks]
        metadatas = []
        ids = []

        for c in chunks:
            # We construct a unique ID per chunk using url and index
            url = c.get("url", "")
            idx = c.get("chunk_index", 0)
            chunk_hash = c.get("chunk_hash", "")
            chunk_id = f"{url}#chunk-{idx}"
            ids.append(chunk_id)
            
            metadatas.append({
                "url": url,
                "title": c.get("title", "Untitled Page"),
                "chunk_index": idx,
                "chunk_hash": chunk_hash,
                "timestamp": c.get("timestamp", "")
            })

        vector_store.add_texts(texts=texts, metadatas=metadatas, ids=ids)
        logger.info(f"Successfully added {len(chunks)} chunks to collection {collection_id}")

    def delete_page_chunks(self, collection_id: int, url: str):
        """Deletes all vector chunks belonging to a specific URL."""
        try:
            vector_store = self.get_vector_store(collection_id)
            # Fetch raw collection inside LangChain vector store
            collection = vector_store._collection
            # Delete by metadata filter
            collection.delete(where={"url": url})
            logger.info(f"Deleted vector chunks for {url} in collection {collection_id}")
        except Exception as e:
            logger.warning(f"Failed to delete chunks for {url} (it might not exist yet): {e}")

    def delete_collection(self, collection_id: int):
        """Deletes the entire Chroma collection namespace."""
        collection_name = self._get_collection_name(collection_id)
        try:
            self.client.delete_collection(collection_name)
            logger.info(f"Deleted Chroma collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Could not delete Chroma collection {collection_name}: {e}")

    def similarity_search(
        self, collection_id: int, query: str, k: int = 5
    ) -> List[Tuple[Document, float]]:
        """
        Performs semantic similarity search returning documents along with scores.
        Converts Chroma's distance to a normalized similarity score: 1 / (1 + distance)
        """
        vector_store = self.get_vector_store(collection_id)
        # return list of (Document, score)
        results = vector_store.similarity_search_with_score(query, k=k)
        
        normalized_results = []
        for doc, distance in results:
            # Chroma distances can be large depending on metric (defaults to L2 distance).
            # Convert L2 distance to a 0-1 similarity score.
            similarity = 1.0 / (1.0 + distance)
            normalized_results.append((doc, similarity))
            
        return normalized_results

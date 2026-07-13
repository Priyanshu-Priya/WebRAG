import asyncio
from datetime import datetime
import json
import logging
from contextlib import asynccontextmanager
from typing import List, Dict
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Local imports
from backend.config.config import settings
from backend.database.connection import init_db, get_db
from backend.database.models import Collection, URL, Page, Chunk, Change, History, DBSetting
from backend.schemas import schemas
from backend.services.index_service import IndexingService
from backend.rag.qa_chain import QAChainManager
from backend.rag.chroma_manager import ChromaManager
from backend.scheduler.scheduler import start_scheduler, stop_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Websocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, collection_id: int, websocket: WebSocket):
        await websocket.accept()
        if collection_id not in self.active_connections:
            self.active_connections[collection_id] = []
        self.active_connections[collection_id].append(websocket)
        logger.info(f"WebSocket client connected to collection {collection_id}")

    def disconnect(self, collection_id: int, websocket: WebSocket):
        if collection_id in self.active_connections:
            self.active_connections[collection_id].remove(websocket)
            if not self.active_connections[collection_id]:
                del self.active_connections[collection_id]
        logger.info(f"WebSocket client disconnected from collection {collection_id}")

    async def broadcast(self, collection_id: int, message: dict):
        if collection_id in self.active_connections:
            for connection in self.active_connections[collection_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message over WebSocket: {e}")

ws_manager = ConnectionManager()
index_service = IndexingService()
qa_manager = QAChainManager()
chroma_manager = ChromaManager()

# Helper to load/initialize dynamic database settings
def load_default_settings(db: Session):
    defaults = {
        "max_crawl_depth": str(settings.CRAWL_MAX_DEPTH),
        "max_pages": str(settings.CRAWL_MAX_PAGES),
        "chunk_size": "1000",
        "embedding_model": settings.EMBEDDING_MODEL_NAME,
        "refresh_interval": str(settings.REFRESH_INTERVAL_HOURS),
        "top_k": "5",
        "temperature": str(settings.LLM_TEMPERATURE)
    }
    for key, val in defaults.items():
        existing = db.query(DBSetting).filter(DBSetting.key == key).first()
        if not existing:
            db_set = DBSetting(key=key, value=val)
            db.add(db_set)
    db.commit()

# Fast API Lifespan events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    logger.info("Initializing relational database tables...")
    init_db()
    
    # Load defaults
    db = Session() if hasattr(Session, "kw") else None
    if not db:
        from backend.database.connection import SessionLocal
        db = SessionLocal()
    try:
        load_default_settings(db)
    finally:
        db.close()

    logger.info("Starting background scheduler...")
    start_scheduler()
    
    yield
    # Shutdown tasks
    logger.info("Stopping background scheduler...")
    stop_scheduler()

app = FastAPI(title="WebRAG Backend API", version="1.0.0", lifespan=lifespan)

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket endpoint for real-time progress
@app.websocket("/api/ws/{collection_id}")
async def websocket_endpoint(websocket: WebSocket, collection_id: int):
    await ws_manager.connect(collection_id, websocket)
    try:
        while True:
            # Maintain connection, handle client pings
            data = await websocket.receive_text()
            # Send keep-alive ping echo
            await websocket.send_json({"type": "ping", "message": "alive"})
    except WebSocketDisconnect:
        ws_manager.disconnect(collection_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket connection error on collection {collection_id}: {e}")
        ws_manager.disconnect(collection_id, websocket)

# ----------------- REST ENDPOINTS -----------------

# GET collections
@app.get("/api/collections", response_model=List[schemas.CollectionResponse])
def get_collections(db: Session = Depends(get_db)):
    collections = db.query(Collection).all()
    return collections

# POST collections
@app.post("/api/collections", response_model=schemas.CollectionResponse)
def create_collection(payload: schemas.CollectionCreate, db: Session = Depends(get_db)):
    # Check if duplicate name
    existing = db.query(Collection).filter(Collection.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A collection with this name already exists.")

    new_collection = Collection(name=payload.name, status="Idle")
    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)

    for url in payload.urls:
        if url.strip():
            db_url = URL(collection_id=new_collection.id, url=url.strip())
            db.add(db_url)
    
    db.commit()
    db.refresh(new_collection)
    return new_collection

# DELETE collection
@app.delete("/api/collections/{collection_id}")
def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")

    # 1. Drop ChromaDB vectors
    chroma_manager.delete_collection(collection_id)

    # 2. SQLite CASCADE deletion handles sub-tables (pages, urls, chunks, history, changes)
    db.delete(collection)
    db.commit()
    
    return {"message": f"Collection {collection_id} deleted successfully."}

# POST index (triggers crawl & vector processing)
@app.post("/api/index/{collection_id}")
def trigger_index(collection_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")

    if collection.status == "Indexing":
        return {"message": "Indexing is already in progress.", "status": "Indexing"}

    async def run_indexing_task():
        # Websocket broadcast callback wrapper
        async def broadcast_ws(payload: dict):
            await ws_manager.broadcast(collection_id, payload)

        # We must create a new session because background_tasks run in threadpools or async loops
        # where the request db session might get closed/recycled.
        from backend.database.connection import SessionLocal
        local_db = SessionLocal()
        try:
            await index_service.index_collection(collection_id, local_db, broadcast_ws)
        finally:
            local_db.close()

    # Schedule async task execution in background
    background_tasks.add_task(run_indexing_task)
    
    return {"message": "Indexing task scheduled successfully.", "status": "Indexing"}

# POST chat (generates RAG grounded answers)
@app.post("/api/chat", response_model=schemas.ChatResponse)
def run_chat(payload: schemas.ChatRequest, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == payload.collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")

    # 1. Retrieve last 5 history turns
    histories = db.query(History).filter(
        History.collection_id == payload.collection_id
    ).order_by(History.timestamp.desc()).limit(5).all()

    # Format history turns. Reverse since they are fetched in desc order
    history_turns = []
    for h in reversed(histories):
        history_turns.append((h.question, h.answer))

    # Read top K retrieval setting from DB or configs
    k_setting = db.query(DBSetting).filter(DBSetting.key == "top_k").first()
    k = int(k_setting.value) if k_setting else 5

    # 2. Run grounded generation
    result = qa_manager.answer_question(
        collection_id=payload.collection_id,
        question=payload.question,
        history_turns=history_turns,
        k=k
    )

    # 3. Store in History Table
    db_history = History(
        collection_id=payload.collection_id,
        question=payload.question,
        answer=result["answer"],
        sources_json=json.dumps(result["sources"]),
        timestamp=datetime.utcnow()
    )
    db.add(db_history)
    db.commit()

    return result

# POST search (pure semantic search sandbox)
@app.post("/api/search", response_model=List[schemas.SearchResult])
def run_search(payload: schemas.SearchRequest, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == payload.collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found.")

    k = payload.k or 5
    try:
        matched_docs = chroma_manager.similarity_search(
            collection_id=payload.collection_id,
            query=payload.query,
            k=k
        )
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []

    results = []
    for doc, score in matched_docs:
        results.append(schemas.SearchResult(
            title=doc.metadata.get("title", "Untitled Page"),
            url=doc.metadata.get("url", ""),
            snippet=doc.page_content,
            score=score
        ))

    return results

# GET history
@app.get("/api/history/{collection_id}", response_model=List[schemas.HistoryResponse])
def get_history(collection_id: int, db: Session = Depends(get_db)):
    histories = db.query(History).filter(History.collection_id == collection_id).order_by(History.timestamp.asc()).all()
    return histories

# GET changes
@app.get("/api/changes/{collection_id}", response_model=List[schemas.ChangeResponse])
def get_changes(collection_id: int, db: Session = Depends(get_db)):
    changes = db.query(Change).filter(Change.collection_id == collection_id).order_by(Change.timestamp.desc()).all()
    return changes

# GET settings
@app.get("/api/settings", response_model=schemas.SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    res = {}
    for db_set in db.query(DBSetting).all():
        if db_set.key in ["max_crawl_depth", "max_pages", "chunk_size", "refresh_interval", "top_k"]:
            res[db_set.key] = int(db_set.value)
        elif db_set.key == "temperature":
            res[db_set.key] = float(db_set.value)
        else:
            res[db_set.key] = db_set.value
    
    # Return defaults if settings are empty in database
    return schemas.SettingsResponse(
        max_crawl_depth=res.get("max_crawl_depth", settings.CRAWL_MAX_DEPTH),
        max_pages=res.get("max_pages", settings.CRAWL_MAX_PAGES),
        chunk_size=res.get("chunk_size", 1000),
        embedding_model=res.get("embedding_model", settings.EMBEDDING_MODEL_NAME),
        refresh_interval=res.get("refresh_interval", settings.REFRESH_INTERVAL_HOURS),
        top_k=res.get("top_k", 5),
        temperature=res.get("temperature", settings.LLM_TEMPERATURE)
    )

# PUT settings
@app.put("/api/settings", response_model=schemas.SettingsResponse)
def update_settings(payload: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    fields = payload.model_dump(exclude_unset=True)
    
    for key, val in fields.items():
        db_set = db.query(DBSetting).filter(DBSetting.key == key).first()
        if db_set:
            db_set.value = str(val)
        else:
            db_set = DBSetting(key=key, value=str(val))
            db.add(db_set)
            
    db.commit()
    
    # Return full settings representation
    return get_settings(db)

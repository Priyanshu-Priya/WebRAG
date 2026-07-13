from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime

# ----------------- Seed URLs -----------------
class URLBase(BaseModel):
    url: str

class URLCreate(URLBase):
    pass

class URLResponse(URLBase):
    id: int
    collection_id: int

    class Config:
        from_attributes = True

# ----------------- Collections -----------------
class CollectionBase(BaseModel):
    name: str

class CollectionCreate(CollectionBase):
    urls: List[str]

class CollectionResponse(CollectionBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    last_indexed: Optional[datetime] = None
    urls: List[URLResponse] = []

    class Config:
        from_attributes = True

# ----------------- Settings -----------------
class SettingsUpdate(BaseModel):
    max_crawl_depth: Optional[int] = None
    max_pages: Optional[int] = None
    chunk_size: Optional[int] = None
    embedding_model: Optional[str] = None
    refresh_interval: Optional[int] = None
    top_k: Optional[int] = None
    temperature: Optional[float] = None

class SettingsResponse(BaseModel):
    max_crawl_depth: int
    max_pages: int
    chunk_size: int
    embedding_model: str
    refresh_interval: int
    top_k: int
    temperature: float

# ----------------- Chat & Search -----------------
class ChatRequest(BaseModel):
    collection_id: int
    question: str

class SourceCitation(BaseModel):
    title: str
    url: str
    snippet: str
    score: float

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceCitation]

class SearchRequest(BaseModel):
    collection_id: int
    query: str
    k: Optional[int] = 5

class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    score: float

# ----------------- Changes & History -----------------
class ChangeResponse(BaseModel):
    id: int
    collection_id: int
    page_url: str
    sections_added: int
    sections_removed: int
    paragraphs_changed: int
    report_text: str
    timestamp: datetime

    class Config:
        from_attributes = True

class HistoryResponse(BaseModel):
    id: int
    collection_id: int
    question: str
    answer: str
    sources_json: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

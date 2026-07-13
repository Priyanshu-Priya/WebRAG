from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default="Idle")  # Idle, Indexing, Failed, Ready
    last_indexed = Column(DateTime, nullable=True)

    # Relationships
    urls = relationship("URL", back_populates="collection", cascade="all, delete-orphan")
    pages = relationship("Page", back_populates="collection", cascade="all, delete-orphan")
    changes = relationship("Change", back_populates="collection", cascade="all, delete-orphan")
    histories = relationship("History", back_populates="collection", cascade="all, delete-orphan")


class URL(Base):
    __tablename__ = "urls"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)

    collection = relationship("Collection", back_populates="urls")


class Page(Base):
    __tablename__ = "pages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    content_hash = Column(String, nullable=False)
    last_modified = Column(String, nullable=True)
    etag = Column(String, nullable=True)
    indexed_time = Column(DateTime, default=datetime.utcnow)

    collection = relationship("Collection", back_populates="pages")
    chunks = relationship("Chunk", back_populates="page", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chunk_hash = Column(String, nullable=False)
    indexed_time = Column(DateTime, default=datetime.utcnow)

    page = relationship("Page", back_populates="chunks")


class Change(Base):
    __tablename__ = "changes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    page_url = Column(String, nullable=False)
    sections_added = Column(Integer, default=0)
    sections_removed = Column(Integer, default=0)
    paragraphs_changed = Column(Integer, default=0)
    report_text = Column(Text, nullable=True)  # Detailed diff report
    timestamp = Column(DateTime, default=datetime.utcnow)

    collection = relationship("Collection", back_populates="changes")


class History(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources_json = Column(Text, nullable=True)  # JSON-encoded array of retrieved sources
    timestamp = Column(DateTime, default=datetime.utcnow)

    collection = relationship("Collection", back_populates="histories")


class DBSetting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(String, nullable=False)

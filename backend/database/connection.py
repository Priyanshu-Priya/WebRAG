from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.config.config import settings
from backend.database.models import Base

# SQLite configuration details. connect_args are needed only for SQLite to prevent threading issues
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initializes sqlite database schemas if they do not exist."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """FastAPI database session generator dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

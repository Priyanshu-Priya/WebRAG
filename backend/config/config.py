import os
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from root or backend parent directory
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "WebRAG"
    
    # API Keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    HF_TOKEN: str = os.getenv("HF_TOKEN", os.getenv("HUGGINGFACEHUB_API_TOKEN", ""))
    
    # LLM Settings
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-specdec")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.0"))
    
    # Embedding Configuration
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-base-en-v1.5")
    
    # Paths & Databases
    CHROMA_DB_DIR: str = os.getenv("CHROMA_DB_DIR", "./data/chromadb")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/webrag.db")
    
    # Crawler Settings
    CRAWL_MAX_DEPTH: int = int(os.getenv("CRAWL_MAX_DEPTH", "2"))
    CRAWL_MAX_PAGES: int = int(os.getenv("CRAWL_MAX_PAGES", "20"))
    CRAWL_USER_AGENT: str = os.getenv("CRAWL_USER_AGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # Scheduler Settings
    REFRESH_INTERVAL_HOURS: int = int(os.getenv("REFRESH_INTERVAL_HOURS", "6"))
    
    @property
    def sqlite_db_path(self) -> Path:
        # Extracts file path from SQLite URL, e.g., sqlite:///./data/webrag.db
        if self.DATABASE_URL.startswith("sqlite:///"):
            path_str = self.DATABASE_URL.replace("sqlite:///", "")
            return Path(path_str)
        return Path("./data/webrag.db")

settings = Settings()

# Ensure directories exist
os.makedirs(os.path.dirname(settings.sqlite_db_path), exist_ok=True)
os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)

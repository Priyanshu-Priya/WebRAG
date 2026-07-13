import logging
from backend.config.config import settings

logger = logging.getLogger(__name__)

# Cached instance
_embeddings_instance = None

def get_embeddings():
    """
    Returns a cached instance of the embeddings class.
    Checks config for cloud API keys (HF_TOKEN or OPENAI_API_KEY) to run remote inference (fits 512MB RAM),
    otherwise falls back to running the model locally on CPU.
    """
    global _embeddings_instance
    if _embeddings_instance is not None:
        return _embeddings_instance

    # 1. Cloud Hugging Face Inference API (Saves RAM, matches local embedding dimension)
    if settings.HF_TOKEN:
        logger.info(f"Initializing cloud HuggingFaceHubEmbeddings via API: {settings.EMBEDDING_MODEL_NAME} ...")
        try:
            from langchain_community.embeddings import HuggingFaceHubEmbeddings
            _embeddings_instance = HuggingFaceHubEmbeddings(
                huggingfacehub_api_token=settings.HF_TOKEN,
                repo_id=settings.EMBEDDING_MODEL_NAME
            )
            logger.info("Cloud Hugging Face Inference API embeddings initialized successfully.")
            return _embeddings_instance
        except Exception as e:
            logger.error(f"Error initializing cloud Hugging Face embeddings: {e}. Falling back...")

    # 2. Cloud OpenAI Embeddings (Saves RAM)
    if settings.OPENAI_API_KEY:
        logger.info("Initializing OpenAI API embeddings (text-embedding-3-small) ...")
        try:
            from langchain_openai import OpenAIEmbeddings
            _embeddings_instance = OpenAIEmbeddings(
                openai_api_key=settings.OPENAI_API_KEY,
                model="text-embedding-3-small"
            )
            logger.info("OpenAI Cloud API embeddings initialized successfully.")
            return _embeddings_instance
        except Exception as e:
            logger.error(f"Error initializing OpenAI embeddings: {e}. Falling back...")

    # 3. Local CPU Embeddings (PyTorch + Sentence Transformers)
    logger.info(f"Loading local embedding model: {settings.EMBEDDING_MODEL_NAME} ...")
    try:
        from langchain_community.embeddings import HuggingFaceBgeEmbeddings
        model_kwargs = {"device": "cpu"}
        encode_kwargs = {"normalize_embeddings": True}
        
        _embeddings_instance = HuggingFaceBgeEmbeddings(
            model_name=settings.EMBEDDING_MODEL_NAME,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs,
            query_instruction="Represent this query for retrieving relevant documents:"
        )
        logger.info("Local BGE embedding model loaded successfully.")
    except Exception as e:
        logger.error(f"Error loading local BGE embedding model: {e}")
        from langchain_community.embeddings import HuggingFaceEmbeddings
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL_NAME,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        logger.info("Local standard HuggingFaceEmbeddings fallback initialized.")
        
    return _embeddings_instance

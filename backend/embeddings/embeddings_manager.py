import logging
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from backend.config.config import settings

logger = logging.getLogger(__name__)

# Cached instance
_embeddings_instance = None

def get_embeddings():
    """
    Returns a cached instance of the LangChain HuggingFace BGE Embeddings class.
    Downloads the model if it is not present locally.
    """
    global _embeddings_instance
    if _embeddings_instance is not None:
        return _embeddings_instance

    logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL_NAME} ...")
    try:
        # Use HuggingFaceBgeEmbeddings for BAAI/bge models to get proper query/document instructions
        model_kwargs = {"device": "cpu"}
        encode_kwargs = {"normalize_embeddings": True}
        
        _embeddings_instance = HuggingFaceBgeEmbeddings(
            model_name=settings.EMBEDDING_MODEL_NAME,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs,
            query_instruction="Represent this query for retrieving relevant documents:"
        )
        logger.info("Embedding model loaded successfully.")
    except Exception as e:
        logger.error(f"Error loading embedding model: {e}")
        # Fallback to standard HuggingFaceEmbeddings if BGE wrapper fails for any reason
        from langchain_community.embeddings import HuggingFaceEmbeddings
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL_NAME,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs
        )
        logger.info("Standard HuggingFaceEmbeddings fallback initialized.")
        
    return _embeddings_instance

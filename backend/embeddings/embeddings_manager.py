import logging
from typing import List
from backend.config.config import settings

logger = logging.getLogger(__name__)

# Cached instance
_embeddings_instance = None


class HFInferenceEmbeddings:
    """
    Lightweight LangChain-compatible embeddings class that calls the
    Hugging Face Inference API directly via huggingface_hub.InferenceClient.
    No torch/onnxruntime needed. Uses ~10MB RAM.
    """
    def __init__(self, model_id: str, api_token: str):
        from huggingface_hub import InferenceClient
        self.client = InferenceClient(model=model_id, token=api_token)
        self.model_id = model_id
        logger.info(f"HFInferenceEmbeddings initialized with model: {model_id}")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents."""
        results = []
        # Process in batches of 32 to avoid payload limits
        batch_size = 32
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_results = self.client.feature_extraction(batch, model=self.model_id)
            # feature_extraction returns nested lists; ensure we get the right shape
            for embedding in batch_results:
                if hasattr(embedding, 'tolist'):
                    results.append(embedding.tolist())
                elif isinstance(embedding, list):
                    # Handle nested list (e.g., token-level embeddings) by mean pooling
                    if isinstance(embedding[0], list):
                        import numpy as np
                        results.append(np.mean(embedding, axis=0).tolist())
                    else:
                        results.append(embedding)
                else:
                    results.append(list(embedding))
        return results

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text."""
        result = self.client.feature_extraction(text, model=self.model_id)
        # Result can be a nested array; flatten if needed
        if hasattr(result, 'tolist'):
            flat = result.tolist()
        else:
            flat = result
        # Handle token-level output: mean pool to a single vector
        if isinstance(flat, list) and len(flat) > 0 and isinstance(flat[0], list):
            import numpy as np
            return np.mean(flat, axis=0).tolist()
        return flat


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
        logger.info(f"Initializing HF Inference API embeddings: {settings.EMBEDDING_MODEL_NAME} ...")
        try:
            _embeddings_instance = HFInferenceEmbeddings(
                model_id=settings.EMBEDDING_MODEL_NAME,
                api_token=settings.HF_TOKEN
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

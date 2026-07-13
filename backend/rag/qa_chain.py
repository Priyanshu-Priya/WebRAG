import logging
from typing import Dict, Any, List, Tuple
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.documents import Document
from backend.config.config import settings
from backend.rag.chroma_manager import ChromaManager

logger = logging.getLogger(__name__)

# Prompt template ensuring grounded generation and history injection
PROMPT_TEMPLATE = """You are WebRAG, a professional AI coding and research assistant.
You must answer the user's question using ONLY the retrieved web page context below.

Rules:
1. Use ONLY the provided Context to answer the question.
2. If the Context does not contain enough information to answer, reply exactly: "I couldn't find information about this in the indexed websites."
3. Do NOT make up any facts or extrapolate beyond the text.
4. Cite sources using numbered bracket inline footnotes at the end of the sentence or statement referencing the source, e.g. [1] or [2], corresponding to the Document Chunk index in the Context below. Do not combine citations into a single bracket; list them separately (e.g., [1][2]).

Conversation History:
{history}

Context:
{context}

Question: {question}

Answer:"""

class QAChainManager:
    def __init__(self):
        self.chroma_manager = ChromaManager()
        self.llm = self._init_llm()

    def _init_llm(self):
        """Initializes ChatGroq LLM with safety fallbacks."""
        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY is empty! RAG queries will fail unless configured.")
            # We will use a mock/stub LLM if no API key is present
            from langchain_core.language_models.fake import FakeListLLM
            return FakeListLLM(responses=["[Stub LLM Output] No Groq API Key was found in configurations."])
            
        logger.info(f"Initializing ChatGroq LLM with model {settings.LLM_MODEL}")
        try:
            return ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model_name=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE
            )
        except Exception as e:
            logger.error(f"Error initializing ChatGroq: {e}. Falling back to default settings.")
            # Fallback to standard OpenAI compatible interface using Groq endpoints
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                openai_api_key=settings.GROQ_API_KEY,
                openai_api_base="https://api.groq.com/openai/v1",
                model_name=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE
            )

    def answer_question(
        self, 
        collection_id: int, 
        question: str, 
        history_turns: List[Tuple[str, str]] = None,
        k: int = 5
    ) -> Dict[str, Any]:
        """
        Retrieves context, formats history, calls Groq, and returns the answer + citations.
        """
        # Format the chat history into a readable string
        history_str = ""
        if history_turns:
            for q, a in history_turns:
                history_str += f"User: {q}\nAssistant: {a}\n"
        if not history_str:
            history_str = "No previous history."

        # Fetch matching documents with scores directly to obtain similarity scores
        try:
            matched_docs_with_scores = self.chroma_manager.similarity_search(
                collection_id=collection_id, 
                query=question, 
                k=k
            )
        except Exception as e:
            logger.error(f"Error searching ChromaDB collection {collection_id}: {e}")
            return {
                "answer": "I couldn't retrieve context from this collection because the index is empty or has not been built yet.",
                "sources": []
            }

        if not matched_docs_with_scores:
            return {
                "answer": "I couldn't find information about this in the indexed websites.",
                "sources": []
            }

        # Extract docs and build score mapping
        docs = [doc for doc, _ in matched_docs_with_scores]
        doc_score_map = {doc.metadata.get("chunk_hash", ""): score for doc, score in matched_docs_with_scores}

        # Setup custom prompt
        prompt = PromptTemplate(
            template=PROMPT_TEMPLATE,
            input_variables=["context", "question", "history"]
        )

        # Setup standard stuff chain helper
        # We manually run the chain or use RetrievalQA with a custom prompt
        vector_store = self.chroma_manager.get_vector_store(collection_id)
        retriever = vector_store.as_retriever(search_kwargs={"k": k})

        # To support passing 'history' parameters into the prompt template,
        # we can build the context manually and call LLM, or configure RetrievalQA chain.
        # Manual execution provides maximum control over variables and scores.
        context_str = ""
        for idx, doc in enumerate(docs):
            context_str += f"--- Document Chunk {idx+1} (Source: {doc.metadata.get('url', 'Unknown')}) ---\n"
            context_str += f"Title: {doc.metadata.get('title', 'Unknown')}\n"
            context_str += f"Content: {doc.page_content}\n\n"

        formatted_prompt = prompt.format(
            context=context_str,
            question=question,
            history=history_str
        )

        logger.info("Invoking LLM for question answering...")
        try:
            response = self.llm.invoke(formatted_prompt)
            answer_text = response.content
        except Exception as e:
            logger.error(f"LLM invocation failed: {e}")
            answer_text = f"An error occurred while generating the answer from Groq: {str(e)}"

        # Clean the response - check if LLM returned any variants of "don't know" or "couldn't find"
        # ensure strictness matching Feature 8 requirement
        if not answer_text or answer_text.strip() == "":
            answer_text = "I couldn't find information about this in the indexed websites."

        # Compile citations list
        citations = []
        for doc, score in matched_docs_with_scores:
            citations.append({
                "title": doc.metadata.get("title", "Untitled Page"),
                "url": doc.metadata.get("url", ""),
                "snippet": doc.page_content,
                "score": round(score, 4)
            })

        return {
            "answer": answer_text,
            "sources": citations
        }

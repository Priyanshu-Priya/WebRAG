import re
import hashlib
from typing import List, Dict, Any
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter

class HTMLCleaner:
    @staticmethod
    def clean(html_content: str) -> str:
        """
        Removes noisy tags (scripts, styles, headers, footers, ads, cookie banners, navigation)
        and returns clean text from primary content tags.
        """
        if not html_content or not html_content.strip():
            return ""

        soup = BeautifulSoup(html_content, "html.parser")

        # 1. Remove unwanted elements
        unwanted_selectors = [
            "script", "style", "nav", "footer", "header", "aside", 
            "noscript", "iframe", "svg", "form", "button",
            ".cookie-banner", ".cookie-consent", ".advertisement", ".ads",
            "#cookie-banner", "#footer", "#header", "#sidebar", "#navigation"
        ]
        for selector in unwanted_selectors:
            for element in soup.select(selector):
                element.decompose()

        # 2. Extract content from main sections if present, otherwise fallback to body
        content_selectors = ["main", "article", "section", "div.content", "div.main-content"]
        main_content = None
        for selector in content_selectors:
            found = soup.select(selector)
            if found:
                # Merge found sections
                main_content = " ".join([f.get_text(separator=" ") for f in found])
                break

        if not main_content:
            body = soup.find("body")
            if body:
                main_content = body.get_text(separator=" ")
            else:
                main_content = soup.get_text(separator=" ")

        # 3. Clean up whitespace
        # Replace multiple spaces/newlines with single ones
        text = re.sub(r"\s+", " ", main_content)
        # Normalize double spacing
        text = text.replace("\n", " ").strip()

        return text

    @staticmethod
    def extract_title(html_content: str) -> str:
        """Extracts the page title or returns a default fallback."""
        if not html_content:
            return "Untitled Page"
        soup = BeautifulSoup(html_content, "html.parser")
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            return title_tag.string.strip()
        h1_tag = soup.find("h1")
        if h1_tag:
            return h1_tag.get_text().strip()
        return "Untitled Page"


def get_text_hash(text: str) -> str:
    """Computes SHA-256 hash of a string."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class Chunker:
    @staticmethod
    def chunk_text(
        text: str, 
        chunk_size: int = 1000, 
        chunk_overlap: int = 200,
        metadata_base: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Splits clean text into chunks and attaches metadata.
        """
        if not text:
            return []

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len
        )
        
        chunks = splitter.split_text(text)
        chunk_dicts = []
        
        for idx, chunk in enumerate(chunks):
            chunk_hash = get_text_hash(chunk)
            
            meta = (metadata_base or {}).copy()
            meta.update({
                "chunk_index": idx,
                "chunk_hash": chunk_hash,
                "content": chunk
            })
            chunk_dicts.append(meta)
            
        return chunk_dicts

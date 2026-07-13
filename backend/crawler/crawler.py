import asyncio
import logging
import re
from urllib.parse import urlparse, urljoin, urldefrag
from typing import AsyncGenerator, Set, Dict, Any, List
import httpx
from bs4 import BeautifulSoup
try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

logger = logging.getLogger(__name__)

# Extensions to ignore during crawl
EXCLUDED_EXTENSIONS = re.compile(
    r"\.(pdf|png|jpe?g|gif|svg|ico|mp4|webm|avi|mp3|wav|zip|tar|gz|rar|exe|dmg|epub|doc|docx|xls|xlsx|ppt|pptx)$",
    re.IGNORECASE
)

class WebCrawler:
    def __init__(
        self,
        max_depth: int = 2,
        max_pages: int = 20,
        user_agent: str = "WebRAG-Bot/1.0 (+http://localhost)",
        timeout_seconds: int = 15
    ):
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds

    def _normalize_url(self, url: str) -> str:
        """Strips fragment identifiers and removes trailing slashes."""
        defragmented, _ = urldefrag(url)
        normalized = defragmented.strip()
        if normalized.endswith("/"):
            normalized = normalized[:-1]
        return normalized

    def _is_same_domain(self, target_url: str, base_domain: str) -> bool:
        """Checks if target_url belongs to the base_domain."""
        try:
            target_domain = urlparse(target_url).netloc.lower()
            # Handle cases where subdomains are involved
            return target_domain == base_domain or target_domain.endswith("." + base_domain)
        except Exception:
            return False

    def _should_ignore_url(self, url: str) -> bool:
        """Filters out non-http, file downloads, or media items."""
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return True
        if EXCLUDED_EXTENSIONS.search(parsed.path):
            return True
        # Ignore common login/logout paths
        if any(keyword in parsed.path.lower() for keyword in ["login", "logout", "signin", "signout", "register"]):
            return True
        return False

    async def _fetch_with_httpx(self, client: httpx.AsyncClient, url: str) -> tuple[int, str, Dict[str, str]]:
        """Performs a fast HTTP request."""
        headers = {"User-Agent": self.user_agent}
        response = await client.get(url, headers=headers, timeout=self.timeout_seconds, follow_redirects=True)
        return response.status_code, response.text, dict(response.headers)

    async def _fetch_with_playwright(self, url: str) -> str:
        """Fallback browser rendering for JavaScript-heavy websites."""
        logger.info(f"Using Playwright rendering fallback for: {url}")
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(user_agent=self.user_agent)
                page = await context.new_page()
                
                # Navigate and wait until network is idle or 10s timeout
                await page.goto(url, timeout=self.timeout_seconds * 1000, wait_until="domcontentloaded")
                try:
                    await page.wait_for_load_state("networkidle", timeout=3000)
                except Exception:
                    pass # Ignore timeout for networkidle, just grab what we have
                
                html = await page.content()
                return html
            finally:
                await browser.close()

    async def crawl(self, seed_urls: List[str]) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Crawls the list of seed URLs, yielding progress updates and crawled page data.
        """
        if not seed_urls:
            return

        normalized_seeds = [self._normalize_url(u) for u in seed_urls if u]
        # Determine allowed domains from seed URLs
        allowed_domains = {urlparse(url).netloc.lower() for url in normalized_seeds if urlparse(url).netloc}

        # Queue of tuples: (url, depth)
        queue = [(url, 0) for url in normalized_seeds]
        visited_urls: Set[str] = set()
        pages_indexed = 0

        # We'll use a single HTTPX client for efficiency
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        async with httpx.AsyncClient(limits=limits, verify=False) as client:
            while queue and pages_indexed < self.max_pages:
                current_url, depth = queue.pop(0)
                current_url = self._normalize_url(current_url)

                if current_url in visited_urls:
                    continue

                visited_urls.add(current_url)
                pages_indexed += 1

                yield {
                    "event": "progress",
                    "status": "active",
                    "message": f"Crawling page {pages_indexed}: {current_url}",
                    "current": pages_indexed,
                    "url": current_url
                }

                html_content = ""
                etag = None
                last_modified = None
                status_code = 200

                try:
                    # 1. Attempt standard HTTP request first
                    status_code, text, headers = await self._fetch_with_httpx(client, current_url)
                    
                    if status_code >= 400:
                        raise httpx.HTTPStatusError(
                            f"HTTP {status_code}", 
                            request=None, 
                            response=httpx.Response(status_code, request=None)
                        )

                    etag = headers.get("etag") or headers.get("ETag")
                    last_modified = headers.get("last-modified") or headers.get("Last-Modified")

                    # 2. Check if page requires JS rendering (no title and minimal text content)
                    soup = BeautifulSoup(text, "html.parser")
                    text_len = len(soup.get_text().strip())
                    
                    # If page is empty or looks like a JS client app wrapper
                    if (text_len < 150 or "javascript is required" in text.lower()) and HAS_PLAYWRIGHT:
                        html_content = await self._fetch_with_playwright(current_url)
                    else:
                        html_content = text

                except Exception as e:
                    logger.warning(f"Failed standard HTTP load for {current_url}: {e}")
                    if HAS_PLAYWRIGHT:
                        try:
                            logger.info(f"Retrying with Playwright for {current_url}...")
                            html_content = await self._fetch_with_playwright(current_url)
                        except Exception as pe:
                            logger.error(f"Playwright fallback also failed for {current_url}: {pe}")
                            yield {
                                "event": "error",
                                "message": f"Failed to retrieve {current_url}: {str(pe)}",
                                "url": current_url
                            }
                            continue
                    else:
                        logger.error(f"Cannot fetch {current_url} (Playwright not installed)")
                        yield {
                            "event": "error",
                            "message": f"Failed to retrieve {current_url}: {str(e)}",
                            "url": current_url
                        }
                        continue

                # Parse out links if we haven't reached max depth
                if depth < self.max_depth:
                    try:
                        soup = BeautifulSoup(html_content, "html.parser")
                        for a_tag in soup.find_all("a", href=True):
                            href = a_tag["href"]
                            absolute_link = urljoin(current_url, href)
                            normalized_link = self._normalize_url(absolute_link)

                            # Validate link fits domains, depth constraints, exclusion filters
                            if normalized_link not in visited_urls:
                                # Check if it matches any of the seed domains
                                is_internal = any(self._is_same_domain(normalized_link, domain) for domain in allowed_domains)
                                if is_internal and not self._should_ignore_url(normalized_link):
                                    # Add to queue if not already queued
                                    if normalized_link not in [q[0] for q in queue]:
                                        queue.append((normalized_link, depth + 1))
                    except Exception as e:
                        logger.warning(f"Error parsing links from {current_url}: {e}")

                # Yield the successfully crawled page content
                yield {
                    "event": "page",
                    "url": current_url,
                    "html": html_content,
                    "etag": etag,
                    "last_modified": last_modified,
                    "status_code": status_code
                }

        yield {
            "event": "progress",
            "status": "completed",
            "message": f"Crawling completed. Processed {pages_indexed} pages.",
            "current": pages_indexed
        }

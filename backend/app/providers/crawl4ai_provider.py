import asyncio
import os
import re
from datetime import UTC, datetime
from typing import Any
import httpx
from bs4 import BeautifulSoup


class Crawl4AIExtractor:
    """Extracts relevant clean content from publicly accessible web pages.
    Uses crawl4ai if installed, otherwise uses robust httpx + BeautifulSoup markdown engine.
    """

    def __init__(self):
        self._has_crawl4ai = False
        try:
            import crawl4ai  # noqa: F401
            self._has_crawl4ai = True
        except ImportError:
            self._has_crawl4ai = False

    async def crawl_url(self, url: str) -> dict[str, Any]:
        """Extracts content from a URL returning title, markdown/text, and raw HTML."""
        if self._has_crawl4ai:
            try:
                from crawl4ai import AsyncWebCrawler
                async with AsyncWebCrawler() as crawler:
                    res = await crawler.arun(url=url)
                    return {
                        "url": url,
                        "title": getattr(res, "title", "") or "",
                        "markdown": getattr(res, "markdown", "") or getattr(res, "text", ""),
                        "raw_html": getattr(res, "html", ""),
                        "engine": "crawl4ai_native",
                        "status": "success",
                        "fetched_at": datetime.now(UTC).isoformat(),
                    }
            except Exception:
                pass

        # Robust Built-in HTML -> Markdown Engine
        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        try:
            async with httpx.AsyncClient(timeout=15, headers=headers, follow_redirects=True) as client:
                resp = await client.get(url)

            if resp.status_code != 200:
                return {
                    "url": url,
                    "status": "error",
                    "error": f"HTTP {resp.status_code}",
                    "markdown": "",
                    "raw_html": "",
                    "engine": "builtin_html_extractor",
                }

            html = resp.text
            soup = BeautifulSoup(html, "html.parser")

            # Remove noise
            for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header", "aside"]):
                tag.decompose()

            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            # Extract paragraphs, headings, list items
            lines = []
            for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
                txt = el.get_text(strip=True)
                if not txt or len(txt) < 15:
                    continue
                if el.name in ["h1", "h2", "h3"]:
                    lines.append(f"\n### {txt}\n")
                elif el.name == "li":
                    lines.append(f"- {txt}")
                else:
                    lines.append(txt)

            clean_markdown = "\n\n".join(lines)

            return {
                "url": url,
                "title": title,
                "markdown": clean_markdown[:25000],  # Cap for storage
                "raw_html": html[:40000],
                "engine": "builtin_html_extractor",
                "status": "success",
                "fetched_at": datetime.now(UTC).isoformat(),
            }
        except Exception as e:
            return {
                "url": url,
                "status": "error",
                "error": str(e),
                "markdown": "",
                "raw_html": "",
                "engine": "builtin_html_extractor",
            }
        finally:
            os.environ.update(saved_proxy)

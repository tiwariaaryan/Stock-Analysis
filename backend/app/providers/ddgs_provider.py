import os
import re
from datetime import UTC, datetime
from typing import Any
import httpx
from bs4 import BeautifulSoup


class DuckDuckGoSearchProvider:
    """Free web and news search fallback using DuckDuckGo."""

    def __init__(self):
        self.html_endpoint = "https://html.duckduckgo.com/html/"
        self.instant_endpoint = "https://api.duckduckgo.com/"

    def search(self, query: str, max_results: int = 8) -> dict[str, Any]:
        """Performs a web search via DuckDuckGo HTML endpoint without requiring API keys."""
        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        try:
            with httpx.Client(timeout=12, follow_redirects=True, headers=headers) as client:
                resp = client.post(self.html_endpoint, data={"q": query, "b": ""})

            if resp.status_code != 200:
                return {"source": "ddgs", "query": query, "error": f"DDGS HTTP {resp.status_code}", "results": []}

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []

            # DuckDuckGo HTML returns result snippets in div.result or div.results_links
            for res in soup.find_all("div", class_=re.compile(r"result\b")):
                a_tag = res.find("a", class_=re.compile(r"result__url|result__title")) or res.find("a")
                snippet_tag = res.find("a", class_="result__snippet") or res.find(class_=re.compile(r"snippet"))
                title_tag = res.find("a", class_="result__url") or a_tag

                if not a_tag:
                    continue

                raw_link = a_tag.get("href", "")
                # Decode DuckDuckGo redirect link /l/?kh=-1&uddg=...
                actual_link = raw_link
                if "uddg=" in raw_link:
                    match = re.search(r'uddg=([^&]+)', raw_link)
                    if match:
                        import urllib.parse
                        actual_link = urllib.parse.unquote(match.group(1))

                title = title_tag.get_text(strip=True) if title_tag else ""
                snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""

                if title and actual_link and not actual_link.startswith("javascript:"):
                    results.append({
                        "title": title,
                        "url": actual_link,
                        "snippet": snippet,
                        "source": "ddgs",
                    })
                    if len(results) >= max_results:
                        break

            return {
                "source": "ddgs",
                "query": query,
                "results": results,
                "fetched_at": datetime.now(UTC).isoformat(),
            }
        except Exception as e:
            return {"source": "ddgs", "query": query, "error": str(e), "results": []}
        finally:
            os.environ.update(saved_proxy)

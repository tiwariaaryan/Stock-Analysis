import os
from datetime import UTC, datetime
from typing import Any
import httpx

from ..config import get_settings


class TavilySearchProvider:
    """Tavily Search API Provider for high-accuracy financial research."""

    def __init__(self):
        self.endpoint = "https://api.tavily.com/search"

    def search(
        self,
        query: str,
        max_results: int = 7,
        search_depth: str = "advanced",
        include_raw_content: bool = False,
    ) -> dict[str, Any]:
        settings = get_settings()
        api_key = settings.tavily_api_key

        if not api_key:
            return {
                "source": "tavily",
                "query": query,
                "error": "TAVILY_API_KEY not configured",
                "results": [],
            }

        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        try:
            payload = {
                "api_key": api_key,
                "query": query,
                "search_depth": search_depth,
                "include_answer": True,
                "include_raw_content": include_raw_content,
                "max_results": max_results,
            }

            with httpx.Client(timeout=15) as client:
                resp = client.post(self.endpoint, json=payload)

            if resp.status_code != 200:
                return {
                    "source": "tavily",
                    "query": query,
                    "error": f"Tavily HTTP {resp.status_code}: {resp.text[:200]}",
                    "results": [],
                }

            data = resp.json()
            results = []
            for item in data.get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("content", ""),
                    "score": item.get("score", 0.0),
                    "raw_content": item.get("raw_content", "") if include_raw_content else "",
                    "source": "tavily",
                })

            return {
                "source": "tavily",
                "query": query,
                "answer": data.get("answer", ""),
                "results": results,
                "raw_response": data,
                "fetched_at": datetime.now(UTC).isoformat(),
            }
        except Exception as e:
            return {
                "source": "tavily",
                "query": query,
                "error": str(e),
                "results": [],
            }
        finally:
            os.environ.update(saved_proxy)

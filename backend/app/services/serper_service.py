"""Search service with centralized Multi-Provider Tiered Caching.
Supports Tavily, Serper, DuckDuckGo (DDGS), and Google News RSS.
Maintains backward compatibility with all existing service imports.
"""
from datetime import UTC, datetime
from typing import Any
import httpx
import os

from ..config import get_settings
from ..providers.search_orchestrator import (
    get_daily_market_context,
    get_symbol_context as orch_get_symbol_context,
    get_call_stats,
    format_search_context,
)

_call_count = 0
_CACHE_HOURS = 6
_SYMBOL_CACHE_HOURS = 2


def get_serper_call_count() -> int:
    return _call_count


def _raw_search(query: str, num_results: int = 10, search_type: str = "search") -> dict:
    """Execute a single Serper API call if configured. Tracks call count."""
    global _call_count
    settings = get_settings()
    if not settings.serper_api_key:
        return {"error": "SERPER_API_KEY not configured", "results": []}

    saved_proxy = {}
    for k in list(os.environ):
        if "proxy" in k.lower():
            saved_proxy[k] = os.environ.pop(k)

    try:
        url = "https://google.serper.dev/news" if search_type == "news" else "https://google.serper.dev/search"

        with httpx.Client(timeout=10) as client:
            resp = client.post(
                url,
                headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
                json={"q": query, "gl": "in", "hl": "en", "num": num_results},
            )

        _call_count += 1

        if resp.status_code != 200:
            return {"error": f"HTTP {resp.status_code}", "results": []}

        data = resp.json()
        results = []
        for item in data.get("organic", data.get("news", [])):
            results.append({
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "link": item.get("link", ""),
                "date": item.get("date", ""),
                "source": item.get("source", ""),
            })

        return {
            "query": query,
            "results": results,
            "knowledge_graph": data.get("knowledgeGraph", {}),
            "answer_box": data.get("answerBox", {}),
        }
    except Exception as e:
        return {"error": str(e), "results": []}
    finally:
        os.environ.update(saved_proxy)


def get_daily_context() -> dict | None:
    """Return cached daily context from orchestrator."""
    from ..providers import search_orchestrator
    if search_orchestrator._DAILY_CONTEXT_CACHE and search_orchestrator._DAILY_CONTEXT_TIME:
        age = (datetime.now(UTC) - search_orchestrator._DAILY_CONTEXT_TIME).total_seconds()
        if age < _CACHE_HOURS * 3600:
            return search_orchestrator._DAILY_CONTEXT_CACHE
    return None


def get_symbol_context(symbol: str) -> dict | None:
    """Return cached symbol-specific context if still valid."""
    from ..providers import search_orchestrator
    sym = symbol.upper()
    if sym in search_orchestrator._SYMBOL_CACHE and sym in search_orchestrator._SYMBOL_CACHE_TIMES:
        age = (datetime.now(UTC) - search_orchestrator._SYMBOL_CACHE_TIMES[sym]).total_seconds()
        if age < _SYMBOL_CACHE_HOURS * 3600:
            return search_orchestrator._SYMBOL_CACHE[sym]
    return None


def run_daily_market_scan(user_symbols: list[str] | None = None) -> dict:
    """Executes multi-provider daily market scan (Google News RSS + Tavily / Serper / DDGS).
    Results cached for 6 hours.
    """
    ctx = get_daily_market_context(user_symbols)
    ctx["serper_calls_used"] = _call_count
    return ctx


def search_symbol_on_demand(symbol: str) -> dict:
    """Tier 3: On-demand symbol search using Tavily / Serper / DDGS."""
    sym = symbol.upper()
    ctx_text = orch_get_symbol_context(sym)
    return {
        "symbol": sym,
        "search_context": ctx_text,
        "fetched_at": datetime.now(UTC).isoformat(),
    }


def get_context_for_feature(feature: str, symbol: str | None = None) -> str:
    """Smart context resolver — returns cached daily context or on-demand search."""
    daily = get_daily_context()

    if feature in ("market_radar", "sentiment", "discovery"):
        if daily:
            return f"{daily.get('market_news', '')}\n\n{daily.get('trending', '')}"
        ctx = get_daily_market_context()
        return f"{ctx.get('market_news', '')}\n\n{ctx.get('trending', '')}"

    if feature in ("conviction", "portfolio_health"):
        if daily:
            return f"{daily.get('user_stocks', '')}\n\n{daily.get('market_news', '')}"
        ctx = get_daily_market_context()
        return f"{ctx.get('user_stocks', '')}\n\n{ctx.get('market_news', '')}"

    if feature in ("should_i_buy", "peer_compare") and symbol:
        return orch_get_symbol_context(symbol)

    return ""


def get_cache_status() -> dict:
    """Return current multi-provider cache status and call metrics."""
    from ..providers import search_orchestrator
    settings = get_settings()

    daily_age = None
    if search_orchestrator._DAILY_CONTEXT_TIME:
        daily_age = round((datetime.now(UTC) - search_orchestrator._DAILY_CONTEXT_TIME).total_seconds())

    stats = get_call_stats()
    return {
        "providers_configured": {
            "tavily": bool(settings.tavily_api_key),
            "serper": bool(settings.serper_api_key),
            "ddgs": True,
            "google_news_rss": True,
            "screener": True,
        },
        "daily_scan_cached": search_orchestrator._DAILY_CONTEXT_CACHE is not None,
        "daily_scan_age_seconds": daily_age,
        "daily_scan_valid": get_daily_context() is not None,
        "cached_symbols": list(search_orchestrator._SYMBOL_CACHE.keys()),
        "call_statistics": stats,
        "total_serper_calls_this_session": stats.get("serper", 0) + _call_count,
    }

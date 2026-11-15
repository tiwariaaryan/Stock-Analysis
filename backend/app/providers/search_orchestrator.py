import json
from datetime import UTC, datetime
from typing import Any
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import SessionLocal
from ..services.data_ingestion_service import store_external_record
from .tavily_provider import TavilySearchProvider
from .ddgs_provider import DuckDuckGoSearchProvider
from .rss_news_provider import RSSNewsProvider

_tavily = TavilySearchProvider()
_ddgs = DuckDuckGoSearchProvider()
_rss = RSSNewsProvider()

# In-memory fast cache
_DAILY_CONTEXT_CACHE: dict | None = None
_DAILY_CONTEXT_TIME: datetime | None = None
_SYMBOL_CACHE: dict[str, dict] = {}
_SYMBOL_CACHE_TIMES: dict[str, datetime] = {}

_CALL_STATS = {
    "tavily": 0,
    "serper": 0,
    "ddgs": 0,
    "google_news_rss": 0,
    "cached_hits": 0,
}


def get_call_stats() -> dict[str, int]:
    return dict(_CALL_STATS)


def format_search_context(search_data: dict) -> str:
    """Standardizes search results into text for LLM consumption."""
    if not search_data:
        return ""

    results = search_data.get("results", [])
    answer = search_data.get("answer")

    lines = []
    if answer:
        lines.append(f"Direct Answer: {answer}")

    kg = search_data.get("knowledge_graph", {})
    if isinstance(kg, dict) and kg.get("title"):
        lines.append(f"Knowledge: {kg['title']} — {kg.get('description', '')}")

    for i, r in enumerate(results[:8], 1):
        t = r.get("title", "")
        snip = r.get("snippet", "")
        src = r.get("source") or r.get("publisher", "")
        lines.append(f"[{i}] {t}")
        if snip:
            lines.append(f"    {snip}")
        if src:
            lines.append(f"    — Source: {src}")

    return "\n".join(lines)


def execute_tiered_search(
    query: str,
    task_priority: str = "important",  # "important" vs "routine"
    symbol: str | None = None,
    category: str = "SEARCH",
    db: Session | None = None,
) -> dict[str, Any]:
    """Tiered search routing:
    - Important: Tavily -> Serper -> DuckDuckGo
    - Routine: DuckDuckGo -> Google News RSS -> Tavily
    Persists raw documents and extracted summaries to the DB.
    """
    settings = get_settings()
    results_payload = None
    chosen_source = ""

    if task_priority == "important":
        # 1. Try Tavily first (primary recurring monthly credits)
        if settings.tavily_api_key:
            res = _tavily.search(query=query, max_results=7, search_depth="advanced")
            if res.get("results") and not res.get("error"):
                _CALL_STATS["tavily"] += 1
                chosen_source = "tavily"
                results_payload = res

        # 2. Fallback to DDGS (free unlimited search to protect Serper quota)
        if not results_payload:
            ddgs_res = _ddgs.search(query=query, max_results=8)
            if ddgs_res.get("results"):
                _CALL_STATS["ddgs"] += 1
                chosen_source = "ddgs"
                results_payload = ddgs_res

        # 3. Emergency Tertiary Backup: Serper (preserves one-time 2500 quota)
        if not results_payload and settings.serper_api_key:
            from ..services.serper_service import _raw_search
            serper_res = _raw_search(query=query, num_results=8)
            if serper_res.get("results") and not serper_res.get("error"):
                _CALL_STATS["serper"] += 1
                chosen_source = "serper"
                results_payload = serper_res

    else:
        # Routine / General Search:
        # 1. Try DDGS first (zero cost)
        ddgs_res = _ddgs.search(query=query, max_results=8)
        if ddgs_res.get("results"):
            _CALL_STATS["ddgs"] += 1
            chosen_source = "ddgs"
            results_payload = ddgs_res
        elif settings.tavily_api_key:
            res = _tavily.search(query=query, max_results=5, search_depth="basic")
            if res.get("results"):
                _CALL_STATS["tavily"] += 1
                chosen_source = "tavily"
                results_payload = res
        elif settings.serper_api_key:
            # Emergency only
            from ..services.serper_service import _raw_search
            serper_res = _raw_search(query=query, num_results=5)
            _CALL_STATS["serper"] += 1
            chosen_source = "serper"
            results_payload = serper_res
        else:
            chosen_source = "ddgs"
            results_payload = ddgs_res

    # Store full raw payload and normalized results to DB
    should_close_db = False
    if db is None:
        db = SessionLocal()
        should_close_db = True

    try:
        raw_text = json.dumps(results_payload, default=str)
        store_external_record(
            db=db,
            category=category,
            source_name=chosen_source or "web",
            raw_content=raw_text,
            symbol=symbol,
            title=f"Search: {query[:100]}",
            extracted_data={
                "query": query,
                "result_count": len(results_payload.get("results", [])),
                "chosen_source": chosen_source,
                "priority": task_priority,
            },
        )
    except Exception:
        pass
    finally:
        if should_close_db:
            db.close()

    return results_payload


def get_daily_market_context(user_symbols: list[str] | None = None) -> dict[str, Any]:
    """Cached daily scan using Google News RSS + Tavily / Serper + DDGS.
    Cached for 6 hours.
    """
    global _DAILY_CONTEXT_CACHE, _DAILY_CONTEXT_TIME
    now = datetime.now(UTC)

    if _DAILY_CONTEXT_CACHE and _DAILY_CONTEXT_TIME:
        age_hours = (now - _DAILY_CONTEXT_TIME).total_seconds() / 3600
        if age_hours < 6:
            _CALL_STATS["cached_hits"] += 1
            return _DAILY_CONTEXT_CACHE

    # Call 1: Market news via free Google News RSS first!
    google_news = _rss.fetch_google_news("Indian stock market NSE Nifty Sensex gainers FII DII", max_items=10)
    _CALL_STATS["google_news_rss"] += 1

    formatted_news = []
    for g in google_news:
        formatted_news.append(f"- {g['title']} ({g['publisher']}): {g['snippet']}")
    news_text = "\n".join(formatted_news)

    # Call 2: Important trending & recommendations via Tiered High-Priority Search
    trending_search = execute_tiered_search(
        "trending Indian stocks buy sell recommendations top picks",
        task_priority="important",
        category="SEARCH",
    )
    trending_text = format_search_context(trending_search)

    # Call 3: User symbols if any
    user_text = ""
    if user_symbols:
        batch = " OR ".join(user_symbols[:6])
        user_search = execute_tiered_search(
            f"({batch}) NSE stock price target research news",
            task_priority="important",
            category="SEARCH",
        )
        user_text = format_search_context(user_search)

    # SEBI & RBI regulatory updates
    regulatory = _rss.fetch_regulatory_updates(max_items=5)
    reg_lines = [f"- [{r.get('authority', 'REGULATOR')}] {r['title']}" for r in regulatory]
    reg_text = "\n".join(reg_lines)

    context = {
        "market_news": f"{news_text}\n\nRegulatory Updates:\n{reg_text}",
        "trending": trending_text,
        "user_stocks": user_text,
        "scanned_at": now.isoformat(),
        "call_stats": dict(_CALL_STATS),
    }

    _DAILY_CONTEXT_CACHE = context
    _DAILY_CONTEXT_TIME = now
    return context


def get_symbol_context(symbol: str) -> str:
    """Fetches or returns cached symbol context.
    Cached for 2 hours. Uses High-Priority Tiered Search.
    """
    sym = symbol.strip().upper()
    now = datetime.now(UTC)

    if sym in _SYMBOL_CACHE and sym in _SYMBOL_CACHE_TIMES:
        age_hours = (now - _SYMBOL_CACHE_TIMES[sym]).total_seconds() / 3600
        if age_hours < 2:
            _CALL_STATS["cached_hits"] += 1
            return _SYMBOL_CACHE[sym]["context"]

    # Also check daily context first
    if _DAILY_CONTEXT_CACHE and sym in _DAILY_CONTEXT_CACHE.get("user_stocks", ""):
        return _DAILY_CONTEXT_CACHE["user_stocks"]

    # Execute Tiered Search for this stock
    search_res = execute_tiered_search(
        f"{sym} NSE stock analysis target price buy sell earnings news",
        task_priority="important",
        symbol=sym,
        category="SEARCH",
    )
    formatted = format_search_context(search_res)

    _SYMBOL_CACHE[sym] = {"context": formatted, "fetched_at": now.isoformat()}
    _SYMBOL_CACHE_TIMES[sym] = now
    return formatted

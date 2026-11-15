import asyncio
import json
from datetime import UTC, datetime
from typing import Any

from ..database import SessionLocal
from ..models import Instrument, Portfolio, Watchlist
from ..providers.crawl4ai_provider import Crawl4AIExtractor
from ..services.data_ingestion_service import store_external_record
from ..services.market_service import resolve_symbol

_crawler = Crawl4AIExtractor()
_last_crawler_run: datetime | None = None
_crawler_run_stats = {
    "total_crawled": 0,
    "last_run": None,
    "status": "idle",
}


def get_crawler_status() -> dict[str, Any]:
    return dict(_crawler_run_stats)


async def run_scheduled_background_crawl():
    """Scheduled background worker: crawls company disclosures for portfolio and watchlist symbols."""
    global _last_crawler_run, _crawler_run_stats
    _crawler_run_stats["status"] = "running"
    now = datetime.now(UTC)

    target_symbols = set()
    with SessionLocal() as db:
        for p in db.query(Portfolio).all():
            for h in p.holdings:
                target_symbols.add(resolve_symbol(h.symbol))
        for w in db.query(Watchlist).all():
            for it in w.items:
                target_symbols.add(resolve_symbol(it.symbol))

    if not target_symbols:
        target_symbols = {"RELIANCE", "TCS", "INFY", "HDFCBANK", "TATAMOTORS"}

    crawled_count = 0
    # Process up to 5 symbols per background run to be respectful of rate limits
    for sym in list(target_symbols)[:5]:
        clean = sym.upper().replace(".NS", "").replace(".BO", "")
        # Crawl public filings / news page
        target_url = f"https://www.screener.in/company/{clean}/consolidated/"
        try:
            res = await _crawler.crawl_url(target_url)
            if res.get("status") == "success" and res.get("markdown"):
                with SessionLocal() as s_db:
                    store_external_record(
                        db=s_db,
                        category="FILING",
                        source_name="crawl4ai",
                        raw_content=res.get("raw_html") or res.get("markdown"),
                        symbol=clean,
                        source_url=target_url,
                        title=f"Corporate Disclosure & Filing: {clean}",
                        extracted_data={
                            "engine": res.get("engine"),
                            "title": res.get("title"),
                            "markdown_length": len(res.get("markdown", "")),
                        },
                        ttl_hours=24,
                    )
                crawled_count += 1
        except Exception:
            pass
        await asyncio.sleep(2)  # Polite throttle

    _crawler_run_stats["total_crawled"] += crawled_count
    _crawler_run_stats["last_run"] = now.isoformat()
    _crawler_run_stats["status"] = "idle"
    _last_crawler_run = now
    return _crawler_run_stats

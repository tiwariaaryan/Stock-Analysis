"""Discovery & data router — /ai-discovery/*, /market-recommendations/*,
/data/*, /crawler/*, and /search/* endpoints."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db

router = APIRouter(prefix="/api/v1/strategy", tags=["discovery"])


@router.post("/market-recommendations/scan")
def trigger_market_recommendations_scan(db: Session = Depends(get_db)):
    """Actively scans Dalal Street market breadth, internet sentiment, top 10 gainers/losers,
    and returns curated Top 5 High-Conviction Buy/Sell recommendations."""
    from ..services.market_scanner_service import run_market_intelligence_scan
    try:
        return run_market_intelligence_scan(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan market recommendations: {str(e)}")


@router.get("/ai-discovery")
def get_ai_discovery_endpoint(user_id: int = 1, db: Session = Depends(get_db)):
    """Autonomous multi-horizon stock discovery across 6 strategies for untouched stocks."""
    from ..services.ai_discovery_service import get_ai_discovery_sections
    try:
        return get_ai_discovery_sections(db, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate AI discovery telecasts: {str(e)}")


@router.post("/ai-discovery/scan")
def trigger_ai_discovery_scan_endpoint(user_id: int = 1, db: Session = Depends(get_db)):
    """Forced rescan of the multi-horizon untouched stock discovery universe."""
    from ..services.ai_discovery_service import get_ai_discovery_sections
    from ..services.vault_service import run_batch_scan_and_archive
    try:
        res = get_ai_discovery_sections(db, user_id=user_id, force_refresh=True)
        try:
            run_batch_scan_and_archive(db, user_id=user_id)
        except Exception:
            pass
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan AI discovery telecasts: {str(e)}")


@router.get("/ai-discovery/vault")
def get_ai_vault_endpoint(user_id: int = 1, db: Session = Depends(get_db)):
    """Retrieves all distinct scan execution runs with nested stock setups and past vs current comparative scores."""
    from ..services.vault_service import get_scan_runs_with_setups
    try:
        return get_scan_runs_with_setups(db, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve vault records: {str(e)}")


@router.post("/ai-discovery/vault/scan-batch")
def scan_next_batch_endpoint(batch_id: int | None = None, user_id: int = 1, db: Session = Depends(get_db)):
    """Rotates to next batch and saves top setups."""
    from ..services.vault_service import run_batch_scan_and_archive
    try:
        return run_batch_scan_and_archive(db, user_id=user_id, batch_id=batch_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute batch scan: {str(e)}")


@router.delete("/ai-discovery/vault/runs/{run_id}")
def delete_scan_run_endpoint(run_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    """Deletes a specific batch scan run and its archived setups from the History Vault."""
    from ..services.vault_service import delete_scan_run
    try:
        success = delete_scan_run(db, run_id=run_id, user_id=user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Scan run not found")
        return {"status": "success", "deleted_run_id": run_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete scan run: {str(e)}")


@router.post("/ai-discovery/sync-scores")
def sync_app_scores_endpoint(user_id: int = 1, db: Session = Depends(get_db)):
    """Computes dynamic live scores for Portfolio & Wishlist while preserving static Sandbox entry scores."""
    from ..services.vault_service import sync_app_scores_and_badges
    try:
        return sync_app_scores_and_badges(db, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync dynamic scores: {str(e)}")


@router.get("/market-recommendations/latest")
def get_latest_market_recommendations_endpoint(db: Session = Depends(get_db)):
    """Retrieves the latest scanned Dalal Street market recommendations and top gainers/losers."""
    from ..services.market_scanner_service import get_latest_market_recommendations
    try:
        return get_latest_market_recommendations(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get market recommendations: {str(e)}")


@router.get("/data/records")
def get_stored_data_records(
    symbol: str | None = None,
    category: str | None = None,
    source_name: str | None = None,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """Retrieve verified external data records, provenance, and source URLs."""
    from ..services.data_ingestion_service import get_fresh_records
    return get_fresh_records(db, symbol=symbol, category=category, source_name=source_name, limit=limit)


@router.post("/crawler/scan")
async def trigger_crawler_scan():
    """Manually trigger background Crawl4AI disclosure crawl."""
    from ..services.background_crawler_service import run_scheduled_background_crawl
    return await run_scheduled_background_crawl()


@router.get("/crawler/status")
def get_crawler_status_endpoint():
    """Check background disclosure crawler status."""
    from ..services.background_crawler_service import get_crawler_status
    return get_crawler_status()


@router.get("/search/stats")
def get_search_provider_stats():
    """Retrieve multi-provider search statistics (Tavily, Serper, DDGS, Google News RSS)."""
    from ..providers.search_orchestrator import get_call_stats
    return get_call_stats()

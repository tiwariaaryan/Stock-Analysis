from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.ai_strategy_service import (
    compute_stock_strategy,
    audit_portfolio_ai_health,
    audit_wishlist_ai_ladders,
    get_macro_market_regime,
    get_daily_actionable_snapshot,
    compute_2year_deep_analysis,
    audit_wishlist_deep_analysis,
)
from ..services.scoring_engine import generate_institutional_stock_report

router = APIRouter(prefix="/api/v1/strategy", tags=["strategy"])


@router.get("/stock/{symbol}")
def get_stock_strategy(symbol: str, db: Session = Depends(get_db)):
    """Computes comprehensive quantitative signals, pattern analogy, and strategy badge for a stock."""
    clean = symbol.strip().upper()
    if not clean.replace("-", "").replace("_", "").replace(".", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid stock symbol")
    try:
        return compute_stock_strategy(clean, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute stock strategy: {str(e)}")


@router.get("/portfolio/{portfolio_id}")
def get_portfolio_ai_health(portfolio_id: int, db: Session = Depends(get_db)):
    """Audits each holding in the portfolio against profit milestones, trailing stops, and capital defense triggers."""
    try:
        return audit_portfolio_ai_health(db, portfolio_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to audit portfolio health: {str(e)}")


@router.get("/wishlist/{watchlist_id}")
def get_wishlist_ai_ladders(watchlist_id: int, db: Session = Depends(get_db)):
    """Audits each item in the wishlist, generating the 3-stage dip accumulation ladder and target alerts."""
    try:
        return audit_wishlist_ai_ladders(db, watchlist_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to audit wishlist ladders: {str(e)}")


@router.get("/market-regime")
def get_market_regime(db: Session = Depends(get_db)):
    """Evaluates Nifty 50 and Sensex against macro trend indicators to determine Macro Regime and cash allocation."""
    try:
        return get_macro_market_regime(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate market regime: {str(e)}")


@router.get("/daily-snapshot")
def get_daily_snapshot(user_id: int = 1, db: Session = Depends(get_db)):
    """Generates the 2-minute actionable snapshot across holdings, wishlists, and macro conditions."""
    try:
        return get_daily_actionable_snapshot(db, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate daily snapshot: {str(e)}")


@router.get("/stock/{symbol}/deep-analysis")
def get_stock_deep_analysis(symbol: str, db: Session = Depends(get_db)):
    """Computes comprehensive 2-year multi-factor quantitative and fundamental deep analysis for a stock."""
    clean = symbol.strip().upper()
    if not clean.replace("-", "").replace("_", "").replace(".", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid stock symbol")
    try:
        return compute_2year_deep_analysis(clean, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute 2-year deep analysis: {str(e)}")


@router.get("/wishlist/{watchlist_id}/deep-analysis")
def get_wishlist_deep_analysis(watchlist_id: int, force_refresh: bool = False, db: Session = Depends(get_db)):
    """Batch-audits all stocks in a wishlist across 2-year multi-factor criteria, returning BUY/HOLD/SELL badges."""
    try:
        return audit_wishlist_deep_analysis(db, watchlist_id, force_refresh=force_refresh)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to audit wishlist deep analysis: {str(e)}")


@router.get("/stock/{symbol}/institutional-report")
def get_institutional_report(symbol: str, db: Session = Depends(get_db)):
    """Generates the full 28-Field Structured Institutional AI Stock Report
    evaluating Fundamental (35%), Technical (20%), Valuation (15%), Market (10%), Sentiment (10%), and Risk (10%).
    """
    clean = symbol.strip().upper()
    if not clean.replace("-", "").replace("_", "").replace(".", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid stock symbol")
    try:
        return generate_institutional_stock_report(clean, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate institutional report: {str(e)}")


@router.post("/market-recommendations/scan")
def trigger_market_recommendations_scan(db: Session = Depends(get_db)):
    """Actively scans Dalal Street market breadth, internet sentiment, top 10 gainers/losers,
    and returns curated Top 5 High-Conviction Buy/Sell recommendations.
    """
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
        # Run live discovery
        res = get_ai_discovery_sections(db, user_id=user_id, force_refresh=True)
        # Archive high-scoring finalists to History Vault
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
    """Rotates to next batch (Batch 1: 500 Large/Mid -> Batch 2: 500 Mid/Small -> Batch 3: 500 Small/Micro) and saves top setups."""
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


# ─── AI Intelligence Features ───

@router.get("/ai/conviction-scores/{watchlist_id}")
def get_conviction_scores(watchlist_id: int, db: Session = Depends(get_db)):
    """Feature 2: AI Conviction Scores for each wishlist stock."""
    from ..services.ai_intelligence_service import compute_conviction_scores
    try:
        return compute_conviction_scores(db, watchlist_id)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.get("/ai/market-radar")
def get_market_radar(db: Session = Depends(get_db)):
    """Feature 1: Daily Market Radar — Hot/Dip/Exit opportunities."""
    from ..services.ai_intelligence_service import generate_market_radar
    try:
        return generate_market_radar(db)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.post("/ai/scan")
def trigger_scan(user_id: int = 1, db: Session = Depends(get_db)):
    """Trigger morning scan: 3 Serper calls, cached 6 hours. All features read from this."""
    from ..services.ai_intelligence_service import trigger_market_scan
    try:
        return trigger_market_scan(db, user_id)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.get("/ai/cache-status")
def get_cache_status_endpoint():
    """Check Serper cache status and call counts."""
    from ..services.serper_service import get_cache_status
    return get_cache_status()


@router.get("/ai/sentiment")
def get_internet_sentiment(db: Session = Depends(get_db)):
    """Feature 3: Internet Sentiment Aggregator — news, social media, YouTube."""
    from ..services.ai_intelligence_service import aggregate_internet_sentiment
    try:
        return aggregate_internet_sentiment(db)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.get("/ai/should-i-buy/{symbol}")
def should_i_buy_endpoint(symbol: str, user_id: int = 1, db: Session = Depends(get_db)):
    """Feature 4: One-click Should I Buy? verdict."""
    from ..services.ai_intelligence_service import should_i_buy
    try:
        return should_i_buy(db, symbol, user_id)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.get("/ai/peer-comparison/{symbol}")
def get_peer_comparison_endpoint(symbol: str, db: Session = Depends(get_db)):
    """Feature 7: Peer Comparison Matrix across sector."""
    from ..services.ai_intelligence_service import get_peer_comparison
    try:
        return get_peer_comparison(db, symbol)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.post("/ai/alerts")
def create_alert(alert_text: str, user_id: int = 1, db: Session = Depends(get_db)):
    """Feature 8: Create smart alert from natural language."""
    from ..services.ai_intelligence_service import create_smart_alert
    try:
        return create_smart_alert(db, user_id, alert_text)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.get("/ai/alerts")
def list_alerts_endpoint(user_id: int = 1):
    """Feature 8: List all active alerts."""
    from ..services.ai_intelligence_service import list_alerts
    return list_alerts(user_id)


@router.get("/ai/alerts/check")
def check_alerts_endpoint(user_id: int = 1, db: Session = Depends(get_db)):
    """Feature 8: Check which alerts have been triggered."""
    from ..services.ai_intelligence_service import check_alerts
    return check_alerts(db, user_id)


@router.delete("/ai/alerts/{alert_id}")
def delete_alert_endpoint(alert_id: int):
    """Feature 8: Delete an alert."""
    from ..services.ai_intelligence_service import delete_alert
    return delete_alert(alert_id)


@router.get("/ai/discovery-feed")
def get_discovery_feed(user_id: int = 1, db: Session = Depends(get_db)):
    """Feature 10: AI Discovery Feed — hidden gems matching your style."""
    from ..services.ai_intelligence_service import generate_discovery_feed
    try:
        return generate_discovery_feed(db, user_id)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


@router.get("/ai/trend-analysis/{symbol}")
def get_trend_analysis(symbol: str, db: Session = Depends(get_db)):
    """Full forward-looking trend prediction: direction, price ranges, bull/base/bear scenarios,
    historical pattern matching, technical signals, fundamental outlook, and risk matrix.
    Timeframes: 1 Week, 1 Month, 6 Months."""
    from ..services.ai_intelligence_service import compute_trend_analysis
    clean = symbol.strip().upper()
    try:
        return compute_trend_analysis(db, clean)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")


# ─── Data Ingestion, Search & Background Crawler Endpoints ───

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





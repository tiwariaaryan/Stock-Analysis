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


@router.get("/market-recommendations/latest")
def get_latest_market_recommendations_endpoint(db: Session = Depends(get_db)):
    """Retrieves the latest scanned Dalal Street market recommendations and top gainers/losers."""
    from ..services.market_scanner_service import get_latest_market_recommendations
    try:
        return get_latest_market_recommendations(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get market recommendations: {str(e)}")




"""AI Intelligence router — /ai/* endpoints for market radar, conviction,
sentiment, buy verdicts, peer comparison, alerts, discovery feed, and trend analysis."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db

router = APIRouter(prefix="/api/v1/strategy", tags=["ai-intelligence"])


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
    historical pattern matching, technical signals, fundamental outlook, and risk matrix."""
    from ..services.ai_intelligence_service import compute_trend_analysis
    clean = symbol.strip().upper()
    try:
        return compute_trend_analysis(db, clean)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

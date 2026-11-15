from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..config import get_settings

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.post("/morning-brief")
def send_morning_brief(user_id: int = 1, db: Session = Depends(get_db)):
    """Send morning market brief email. 0 API calls — uses cached DB data."""
    from ..services.email_service import send_morning_brief
    return send_morning_brief(db, user_id)


@router.post("/wishlist-alerts")
def send_wishlist_alerts(user_id: int = 1, db: Session = Depends(get_db)):
    """Check wishlist targets and email if any hit. 0 API calls."""
    from ..services.email_service import send_wishlist_alerts
    return send_wishlist_alerts(db, user_id)


@router.post("/weekly-report")
def send_weekly_report(user_id: int = 1, db: Session = Depends(get_db)):
    """Send comprehensive weekly portfolio report. 0 API calls."""
    from ..services.email_service import send_weekly_report
    return send_weekly_report(db, user_id)


@router.post("/check-all")
def check_all_notifications(user_id: int = 1, db: Session = Depends(get_db)):
    """Check all notification triggers and send emails if needed."""
    from ..services.email_service import check_and_send_notifications
    return check_and_send_notifications(db, user_id)


@router.get("/settings")
def get_notification_settings():
    """View current email notification settings."""
    settings = get_settings()
    return {
        "gmail_configured": bool(settings.gmail_address and settings.gmail_app_password),
        "gmail_address": settings.gmail_address[:3] + "***" if settings.gmail_address else None,
        "notification_email": settings.notification_email[:3] + "***" if settings.notification_email else None,
    }

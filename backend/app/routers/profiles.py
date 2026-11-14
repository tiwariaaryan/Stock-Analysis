import hashlib
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Portfolio, Watchlist, ChatSession
from ..schemas import ProfileCreate, UserOut, PinVerify

router = APIRouter(prefix="/api/v1/profiles")


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


@router.get("", response_model=list[UserOut])
def list_profiles(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at).all()


@router.post("", response_model=UserOut)
def create_profile(data: ProfileCreate, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    if not username or len(username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")
    if not data.pin or len(data.pin) < 4:
        raise HTTPException(400, "PIN must be at least 4 digits")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(400, f"Username '{username}' already exists")

    user = User(
        username=username,
        display_name=data.display_name.strip(),
        preferences=_hash_pin(data.pin),
        created_at=datetime.now(UTC),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/verify", response_model=UserOut)
def verify_pin(user_id: int, data: PinVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Profile not found")
    if user.preferences != _hash_pin(data.pin):
        raise HTTPException(401, "Incorrect PIN")
    return user


@router.delete("/{user_id}/data")
def wipe_user_data(user_id: int, data: PinVerify, db: Session = Depends(get_db)):
    """Wipe all data for a user (portfolios, watchlists, chat) after PIN verification."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Profile not found")
    if user.preferences != _hash_pin(data.pin):
        raise HTTPException(401, "Incorrect PIN")

    for p in db.query(Portfolio).filter(Portfolio.user_id == user_id).all():
        db.delete(p)
    for w in db.query(Watchlist).filter(Watchlist.user_id == user_id).all():
        db.delete(w)
    for s in db.query(ChatSession).filter(ChatSession.user_id == user_id).all():
        db.delete(s)
    db.commit()
    return {"status": "wiped", "user_id": user_id}

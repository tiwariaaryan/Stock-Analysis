from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Instrument, Watchlist, WatchlistItem
from ..schemas import WatchlistCreate, WatchlistOut, WatchlistItemCreate, WatchlistItemOut, WatchlistDetail
from ..services.market_service import get_or_create_instrument, get_cached_price, resolve_symbol

router = APIRouter(prefix="/api/v1/watchlists")


@router.get("", response_model=list[WatchlistOut])
def list_watchlists(user_id: int | None = None, db: Session = Depends(get_db)):
    target_user_id = user_id if user_id is not None else 1
    lists = db.query(Watchlist).filter(Watchlist.user_id == target_user_id).order_by(Watchlist.created_at.desc()).all()
    if not lists:
        # Ensure every user has at least one default watchlist
        default_wl = Watchlist(
            user_id=target_user_id,
            name="My Wishlist",
            description="Default wishlist",
            is_default=True,
            created_at=datetime.now(UTC),
        )
        db.add(default_wl)
        db.commit()
        db.refresh(default_wl)
        lists = [default_wl]

    return [
        WatchlistOut(
            id=w.id, user_id=w.user_id, name=w.name,
            description=w.description, is_default=w.is_default,
            items_count=len(w.items),
            symbols=[it.symbol for it in w.items],
            created_at=w.created_at,
        )
        for w in lists
    ]


@router.post("", response_model=WatchlistOut)
def create_watchlist(data: WatchlistCreate, user_id: int | None = None, db: Session = Depends(get_db)):
    target_user_id = user_id if user_id is not None else 1
    w = Watchlist(
        user_id=target_user_id, name=data.name.strip(),
        description=data.description, is_default=False,
        created_at=datetime.now(UTC),
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return WatchlistOut(
        id=w.id, user_id=w.user_id, name=w.name,
        description=w.description, is_default=w.is_default,
        items_count=0,
        symbols=[],
        created_at=w.created_at,
    )


@router.get("/{watchlist_id}", response_model=WatchlistDetail)
def get_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    w = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not w:
        raise HTTPException(404, "Watchlist not found")

    items_out = []
    for item in w.items:
        inst = db.query(Instrument).filter(Instrument.id == item.instrument_id).first() if item.instrument_id else None
        cmp = get_cached_price(db, item.symbol)
        items_out.append(WatchlistItemOut(
            id=item.id, watchlist_id=item.watchlist_id, symbol=item.symbol,
            name=inst.name if inst else item.symbol,
            current_price=cmp,
            target_buy_price=item.target_buy_price,
            target_sell_price=item.target_sell_price,
            notes=item.notes, tags=item.tags,
            alert_active=item.alert_active, created_at=item.created_at,
        ))

    return WatchlistDetail(
        id=w.id, name=w.name, description=w.description,
        is_default=w.is_default, created_at=w.created_at, items=items_out,
    )


@router.post("/{watchlist_id}/items", response_model=WatchlistItemOut)
def add_watchlist_item(watchlist_id: int, data: WatchlistItemCreate, db: Session = Depends(get_db)):
    w = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not w:
        raise HTTPException(404, "Watchlist not found")

    sym = resolve_symbol(data.symbol)
    existing = db.query(WatchlistItem).filter(
        WatchlistItem.watchlist_id == watchlist_id, WatchlistItem.symbol == sym,
    ).first()
    inst = get_or_create_instrument(db, sym)
    if existing:
        if data.target_buy_price is not None:
            existing.target_buy_price = data.target_buy_price
        if data.target_sell_price is not None:
            existing.target_sell_price = data.target_sell_price
        if data.notes:
            existing.notes = data.notes
        db.commit()
        db.refresh(existing)
        return WatchlistItemOut(
            id=existing.id, watchlist_id=existing.watchlist_id, symbol=existing.symbol,
            name=inst.name if inst else existing.symbol, current_price=None,
            target_buy_price=existing.target_buy_price,
            target_sell_price=existing.target_sell_price,
            notes=existing.notes, tags=existing.tags,
            alert_active=existing.alert_active, created_at=existing.created_at,
        )
    item = WatchlistItem(
        watchlist_id=watchlist_id, instrument_id=inst.id, symbol=sym,
        target_buy_price=data.target_buy_price,
        target_sell_price=data.target_sell_price,
        notes=data.notes, tags=data.tags,
        alert_active=True, created_at=datetime.now(UTC),
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return WatchlistItemOut(
        id=item.id, watchlist_id=item.watchlist_id, symbol=item.symbol,
        name=inst.name, current_price=None,
        target_buy_price=item.target_buy_price,
        target_sell_price=item.target_sell_price,
        notes=item.notes, tags=item.tags,
        alert_active=item.alert_active, created_at=item.created_at,
    )


@router.delete("/{watchlist_id}/items/{item_id}")
def remove_watchlist_item(watchlist_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.query(WatchlistItem).filter(
        WatchlistItem.id == item_id, WatchlistItem.watchlist_id == watchlist_id,
    ).first()
    if not item:
        raise HTTPException(404, "Watchlist item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}


@router.patch("/{watchlist_id}/items/{item_id}")
def update_watchlist_item(watchlist_id: int, item_id: int, data: WatchlistItemCreate, db: Session = Depends(get_db)):
    item = db.query(WatchlistItem).filter(
        WatchlistItem.id == item_id, WatchlistItem.watchlist_id == watchlist_id,
    ).first()
    if not item:
        raise HTTPException(404, "Watchlist item not found")
    if data.target_buy_price is not None:
        item.target_buy_price = data.target_buy_price
    if data.target_sell_price is not None:
        item.target_sell_price = data.target_sell_price
    if data.notes is not None:
        item.notes = data.notes
    if data.tags is not None:
        item.tags = data.tags
    db.commit()
    db.refresh(item)
    cmp = get_cached_price(db, item.symbol)
    inst = db.query(Instrument).filter(Instrument.id == item.instrument_id).first() if item.instrument_id else None
    return WatchlistItemOut(
        id=item.id, watchlist_id=item.watchlist_id, symbol=item.symbol,
        name=inst.name if inst else item.symbol, current_price=cmp,
        target_buy_price=item.target_buy_price, target_sell_price=item.target_sell_price,
        notes=item.notes, tags=item.tags, alert_active=item.alert_active, created_at=item.created_at,
    )


@router.delete("/{watchlist_id}")
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    w = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not w:
        raise HTTPException(404, "Watchlist not found")
    db.delete(w)
    db.commit()
    return {"status": "deleted"}

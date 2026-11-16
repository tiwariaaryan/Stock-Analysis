import os
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Instrument, MarketPrice, MarketIndex
from ..schemas import Quote, StockDetail, MarketStock, MarketIndexOut
from ..services.market_service import (
    market_data, POPULAR_STOCKS, resolve_symbol,
    get_or_create_instrument, cache_market_price,
    refresh_all_locked, get_last_refresh_time, seed_indices_if_empty,
)

router = APIRouter(prefix="/api/v1")


@router.post("/market/stocks/{symbol}/sync")
async def sync_single_stock(symbol: str, db: Session = Depends(get_db)):
    """Live Sync: on-demand single stock price fetch from waterfall quoting engine."""
    from ..services.market_service import _fetch_quote_waterfall, _save_quote_to_db
    resolved = resolve_symbol(symbol)
    clean = resolved.upper().replace(".NS", "").replace(".BO", "")
    inst = get_or_create_instrument(db, clean)
    q = _fetch_quote_waterfall(clean)
    if q and q.get("price") and q["price"] > 0:
        _save_quote_to_db(db, inst, q)
        return {
            "symbol": clean,
            "price": float(q["price"]),
            "change": float(q["change"]) if q.get("change") is not None else None,
            "change_pct": float(q["change_pct"]) if q.get("change_pct") is not None else None,
            "source": q.get("source", "waterfall"),
            "status": "synced",
            "as_of": datetime.now(UTC).isoformat(),
        }
    q_fallback = await market_data.quote(resolved)
    if q_fallback and q_fallback.price is not None:
        cache_market_price(db, inst, q_fallback)
        return {
            "symbol": resolved,
            "price": float(q_fallback.price),
            "change": None,
            "change_pct": None,
            "source": q_fallback.source,
            "status": "synced",
            "as_of": q_fallback.as_of.isoformat() if q_fallback.as_of else datetime.now(UTC).isoformat(),
        }
    raise HTTPException(status_code=502, detail=f"Could not sync live quote for {symbol}")


@router.get("/quotes/{symbol}", response_model=Quote)
async def quote(symbol: str, db: Session = Depends(get_db)):
    if not symbol.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(400, "Invalid symbol")
    resolved = resolve_symbol(symbol)
    q = await market_data.quote(resolved)
    if q.price is not None:
        inst = get_or_create_instrument(db, resolved)
        cache_market_price(db, inst, q)
    return q


@router.get("/market/stocks", response_model=list[MarketStock])
async def list_stocks(db: Session = Depends(get_db)):
    results = []
    for s, n, sec in POPULAR_STOCKS:
        inst = get_or_create_instrument(db, s, name=n, sector=sec)
        mp = db.query(MarketPrice).filter(
            MarketPrice.instrument_id == inst.id,
        ).order_by(MarketPrice.fetched_at.desc()).first()

        p = mp.price if mp else None
        chg_pct = mp.change_pct if mp else None
        # Mathematical safety: calculate change_pct if stuck at 0.0 while price and prev_close differ
        if (chg_pct is None or float(chg_pct) == 0.0) and mp and mp.prev_close and float(mp.prev_close) > 0 and p:
            diff = float(p) - float(mp.prev_close)
            if abs(diff) > 0.0001:
                chg_pct = round((diff / float(mp.prev_close)) * 100, 2)

        results.append(MarketStock(
            symbol=s, name=n, sector=sec,
            price=p,
            change_pct=chg_pct,
        ))
    return results


@router.get("/market/search")
async def search_stocks(q: str = "", db: Session = Depends(get_db)):
    raw_q = q.strip().upper()
    if not raw_q:
        return []

    from ..services.market_service import _fetch_quote_waterfall, _save_quote_to_db

    resolved_q = resolve_symbol(raw_q)
    matches: list[MarketStock] = []
    existing_syms: set[str] = set()

    # 1. Search popular stocks first
    for s, n, sec in POPULAR_STOCKS:
        if raw_q in s or raw_q in n.upper() or resolved_q == s:
            inst = get_or_create_instrument(db, s, name=n, sector=sec)
            mp = db.query(MarketPrice).filter(
                MarketPrice.instrument_id == inst.id,
            ).order_by(MarketPrice.fetched_at.desc()).first()
            p = mp.price if mp else None
            chg_pct = mp.change_pct if mp else None

            # If no cached price, quick fetch via waterfall
            if p is None:
                q_data = _fetch_quote_waterfall(s)
                if q_data:
                    _save_quote_to_db(db, inst, q_data)
                    p = q_data["price"]
                    chg_pct = q_data["change_pct"]

            # Mathematical safety against stuck +0.00%
            if (chg_pct is None or float(chg_pct) == 0.0) and mp and mp.prev_close and float(mp.prev_close) > 0 and p:
                diff = float(p) - float(mp.prev_close)
                if abs(diff) > 0.0001:
                    chg_pct = round((diff / float(mp.prev_close)) * 100, 2)

            matches.append(MarketStock(
                symbol=s, name=n, sector=sec,
                price=p,
                change_pct=chg_pct,
            ))
            existing_syms.add(s)

    # 2. Search instruments already in the DB
    db_matches = db.query(Instrument).filter(
        (Instrument.symbol.ilike(f"%{raw_q}%")) | (Instrument.name.ilike(f"%{raw_q}%"))
    ).limit(15).all()

    for inst in db_matches:
        if inst.symbol not in existing_syms:
            mp = db.query(MarketPrice).filter(
                MarketPrice.instrument_id == inst.id,
            ).order_by(MarketPrice.fetched_at.desc()).first()
            p = mp.price if mp else None
            chg_pct = mp.change_pct if mp else None

            if p is None:
                q_data = _fetch_quote_waterfall(inst.symbol)
                if q_data:
                    _save_quote_to_db(db, inst, q_data)
                    p = q_data["price"]
                    chg_pct = q_data["change_pct"]

            # Mathematical safety against stuck +0.00%
            if (chg_pct is None or float(chg_pct) == 0.0) and mp and mp.prev_close and float(mp.prev_close) > 0 and p:
                diff = float(p) - float(mp.prev_close)
                if abs(diff) > 0.0001:
                    chg_pct = round((diff / float(mp.prev_close)) * 100, 2)

            matches.append(MarketStock(
                symbol=inst.symbol, name=inst.name or inst.symbol,
                sector=inst.sector, price=p,
                change_pct=chg_pct,
            ))
            existing_syms.add(inst.symbol)

    # 3. Live search via Yahoo Finance Search API for any unlisted stock / ETF
    if len(raw_q) >= 2:
        import httpx
        try:
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={raw_q}&quotesCount=8&newsCount=0"
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    quotes = resp.json().get("quotes", [])
                    for item in quotes:
                        raw_sym = item.get("symbol", "")
                        exch = item.get("exchDisp", "")
                        if ".NS" in raw_sym or ".BO" in raw_sym or exch in ("NSE", "Bombay", "BSE"):
                            clean_sym = raw_sym.replace(".NS", "").replace(".BO", "")
                            if clean_sym not in existing_syms:
                                name = item.get("longname") or item.get("shortname") or clean_sym
                                sec = item.get("sector") or item.get("quoteType") or "EQUITY"
                                inst = get_or_create_instrument(db, clean_sym, name=name, sector=sec)
                                mp = db.query(MarketPrice).filter(
                                    MarketPrice.instrument_id == inst.id,
                                ).order_by(MarketPrice.fetched_at.desc()).first()
                                price = mp.price if mp else None
                                change_pct = mp.change_pct if mp else None

                                if price is None:
                                    try:
                                        q_data = _fetch_quote_waterfall(clean_sym)
                                        if q_data:
                                            _save_quote_to_db(db, inst, q_data)
                                            price = q_data["price"]
                                            change_pct = q_data["change_pct"]
                                    except Exception:
                                        pass

                                # Mathematical safety against stuck +0.00%
                                if (change_pct is None or float(change_pct) == 0.0) and mp and mp.prev_close and float(mp.prev_close) > 0 and price:
                                    diff = float(price) - float(mp.prev_close)
                                    if abs(diff) > 0.0001:
                                        change_pct = round((diff / float(mp.prev_close)) * 100, 2)

                                matches.append(MarketStock(
                                    symbol=clean_sym,
                                    name=name,
                                    sector=sec,
                                    price=price,
                                    change_pct=change_pct,
                                ))
                                existing_syms.add(clean_sym)
        except Exception:
            pass

    # 4. If still no matches, try direct waterfall fetch for the resolved symbol
    if not matches:
        try:
            q_data = _fetch_quote_waterfall(resolved_q)
            if q_data:
                inst = get_or_create_instrument(db, resolved_q)
                _save_quote_to_db(db, inst, q_data)
                matches.append(MarketStock(
                    symbol=resolved_q,
                    name=inst.name or resolved_q,
                    sector=inst.sector or "EQUITY",
                    price=q_data["price"],
                    change_pct=q_data["change_pct"],
                ))
            else:
                matches.append(MarketStock(symbol=resolved_q, name=f"{resolved_q} (tap to view)", sector=None))
        except Exception:
            matches.append(MarketStock(symbol=resolved_q, name=f"{resolved_q} (tap to view)", sector=None))

    return matches

    return matches


@router.get("/market/indices", response_model=list[MarketIndexOut])
async def get_market_indices(db: Session = Depends(get_db)):
    return seed_indices_if_empty(db)


@router.post("/market/refresh-all")
async def refresh_all_prices(user_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    result = await refresh_all_locked(db, user_id=user_id)
    # Check if any updated price hit target or stop-loss in active sandboxes
    try:
        from ..services.arena_service import check_and_execute_arena_triggers
        check_and_execute_arena_triggers(db)
    except Exception as e:
        print(f"[arena-auto-trigger-error] {e}")
    return result


@router.get("/market/refresh-status")
def refresh_status():
    t = get_last_refresh_time()
    return {
        "last_refresh": t.isoformat() if t else None,
        "age_seconds": (datetime.now(UTC) - t).total_seconds() if t else None,
    }


@router.get("/market/drawdown-scanner")
def drawdown_scanner(db: Session = Depends(get_db)):
    from ..services.market_scanner import get_drawdown_scanner
    return get_drawdown_scanner(db)


@router.get("/market/movers")
def market_movers(db: Session = Depends(get_db)):
    from ..services.market_scanner import get_market_movers
    return get_market_movers(db)


@router.get("/market/heatmap")
def market_heatmap(db: Session = Depends(get_db)):
    from ..services.market_scanner import get_sector_heatmap
    return get_sector_heatmap(db)

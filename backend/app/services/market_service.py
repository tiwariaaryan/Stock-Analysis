import asyncio
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Instrument, MarketPrice, MarketIndex, Portfolio, Watchlist, ArenaPosition, ArenaSandbox
from ..providers.yfinance_provider import YFinanceEodProvider
from ..providers.google_finance_provider import GoogleFinanceProvider
from ..providers.nse_india_provider import NseIndiaProvider
from ..providers.gemini_search_provider import GeminiSearchProvider, fetch_missing_prices_via_llm
from ..services.market_data import MarketDataService
from .market_constants import POPULAR_STOCKS, SYMBOL_ALIASES, DEFAULT_INDICES  # noqa: F401 — re-exported
from .market_quote_fetchers import (  # noqa: F401 — re-exported
    _fetch_quote_google_finance, _fetch_quote_nse_india,
    _fetch_quote_screener, _fetch_quote_fast, _fetch_quote_waterfall,
)

market_data = MarketDataService([YFinanceEodProvider(), NseIndiaProvider(), GoogleFinanceProvider(), GeminiSearchProvider()])

_last_refresh_time: datetime | None = None
_refresh_lock = asyncio.Lock()


def resolve_symbol(raw: str) -> str:
    """Resolve aliases and typos to canonical NSE ticker symbol."""
    cleaned = raw.strip().upper().replace(".NS", "").replace(".BO", "")
    return SYMBOL_ALIASES.get(cleaned, cleaned)


def get_or_create_instrument(
    db: Session, symbol: str, name: str | None = None,
    asset_type: str = "EQUITY", sector: str | None = None,
) -> Instrument:
    sym = resolve_symbol(symbol)
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    if not inst:
        inst = Instrument(
            symbol=sym, name=name or sym, asset_type=asset_type,
            exchange="NSE", sector=sector, is_active=True,
        )
        db.add(inst)
        db.commit()
        db.refresh(inst)
    elif name and inst.name == inst.symbol:
        inst.name = name
        if sector and not inst.sector:
            inst.sector = sector
        db.commit()
    return inst


def cache_market_price(db: Session, inst: Instrument, quote) -> None:
    mp = db.query(MarketPrice).filter(
        MarketPrice.instrument_id == inst.id, MarketPrice.source == quote.source,
    ).first()
    if not mp:
        mp = MarketPrice(
            instrument_id=inst.id, price=quote.price, currency=quote.currency,
            as_of=quote.as_of or datetime.now(UTC), fetched_at=quote.fetched_at,
            source=quote.source, data_kind=quote.freshness, freshness=quote.freshness,
        )
        db.add(mp)
    else:
        mp.price = quote.price
        mp.as_of = quote.as_of or datetime.now(UTC)
        mp.fetched_at = quote.fetched_at
        mp.freshness = quote.freshness
    db.commit()


def get_cached_price(db: Session, symbol: str) -> Decimal | None:
    sym = resolve_symbol(symbol)
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    if not inst:
        return None
    mp = db.query(MarketPrice).filter(
        MarketPrice.instrument_id == inst.id,
    ).order_by(MarketPrice.fetched_at.desc()).first()
    return mp.price if mp else None


def get_live_or_cached_price(db: Session, symbol: str) -> Decimal:
    """Fetch cached price or run 4-tier waterfall if not yet cached, updating cache transparently."""
    sym = resolve_symbol(symbol)
    p = get_cached_price(db, sym)
    # If price exists, is positive, and is not a corrupted flat dummy (e.g. 1000.0 or 100.0), return cached
    if p and p > Decimal("0") and p != Decimal("1000.00") and p != Decimal("1000.0"):
        return p
    # Try fetching 4-tier waterfall quote
    try:
        q = _fetch_quote_waterfall(sym)
        if q and q.get("price") and q["price"] > 0:
            update_stock_market_price(db, sym, q["price"], q.get("change_pct"), source=q.get("source", "waterfall"))
            return Decimal(str(round(q["price"], 2)))
    except Exception:
        pass
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    if inst and inst.market_price and inst.market_price.price and inst.market_price.price != Decimal("1000.0"):
        return inst.market_price.price
    return Decimal("100.00")


def update_stock_market_price(db: Session, symbol: str, price: float | Decimal, change_pct: float | None = None, source: str = "write_through") -> None:
    """Write-through cache update: immediately updates main DB price record with newly discovered price."""
    if not price or float(price) <= 0:
        return
    sym = resolve_symbol(symbol)
    inst = get_or_create_instrument(db, sym)
    dec_price = Decimal(str(round(float(price), 2)))
    now = datetime.now(UTC)
    mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).order_by(MarketPrice.fetched_at.desc()).first()
    if mp:
        mp.price = dec_price
        mp.close = dec_price
        mp.fetched_at = now
        mp.as_of = now
        if change_pct is not None and float(change_pct) != 0.0:
            mp.change_pct = float(change_pct)
            if mp.prev_close and float(mp.prev_close) > 0:
                mp.change = Decimal(str(round(float(dec_price) - float(mp.prev_close), 4)))
        elif mp.prev_close and float(mp.prev_close) > 0:
            diff = float(dec_price) - float(mp.prev_close)
            if abs(diff) > 0.0001:
                mp.change = Decimal(str(round(diff, 4)))
                mp.change_pct = round((diff / float(mp.prev_close)) * 100, 2)
        mp.freshness = "LIVE"
    else:
        mp = MarketPrice(
            instrument_id=inst.id,
            price=dec_price,
            close=dec_price,
            currency="INR",
            change_pct=change_pct,
            as_of=now,
            fetched_at=now,
            source=source,
            data_kind="LIVE",
            freshness="LIVE",
        )
        db.add(mp)
    db.commit()


def get_last_refresh_time() -> datetime | None:
    return _last_refresh_time


def _save_quote_to_db(db: Session, inst: Instrument, data: dict):
    now = datetime.now(UTC)
    price = data["price"]
    prev_close = data.get("prev_close")
    chg = data.get("change")
    chg_pct = data.get("change_pct")

    mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).first()

    # Guard: Never overwrite high-precision live quote with low-precision scraped fallback
    if mp and mp.price and mp.freshness in ("OFFICIAL_EXCHANGE", "LIVE") and data.get("freshness") == "SCRAPED":
        return

    # Inherit existing prev_close if missing from scraped quote
    if not prev_close and mp and mp.prev_close and float(mp.prev_close) > 0:
        prev_close = mp.prev_close

    # Math safety: Auto-compute change and change_pct if stuck at 0.0 or None while price and prev_close differ
    if prev_close and float(prev_close) > 0 and (chg_pct is None or float(chg_pct) == 0.0):
        diff = float(price) - float(prev_close)
        if abs(diff) > 0.0001:
            chg = Decimal(str(round(diff, 4)))
            chg_pct = round((diff / float(prev_close)) * 100, 2)

    if not mp:
        mp = MarketPrice(
            instrument_id=inst.id,
            price=price,
            currency="INR",
            change=chg,
            change_pct=chg_pct,
            open=data.get("open"),
            high=data.get("high"),
            low=data.get("low"),
            close=data.get("close") or price,
            prev_close=prev_close,
            volume=data.get("volume"),
            week_52_high=data.get("week_52_high"),
            week_52_low=data.get("week_52_low"),
            as_of=now,
            fetched_at=now,
            source=data.get("source", "fast_fetch"),
            data_kind="LIVE",
            freshness=data.get("freshness", "LIVE"),
        )
        db.add(mp)
    else:
        mp.price = price
        if chg is not None: mp.change = chg
        if chg_pct is not None: mp.change_pct = chg_pct
        if data.get("open") is not None: mp.open = data["open"]
        if data.get("high") is not None: mp.high = data["high"]
        if data.get("low") is not None: mp.low = data["low"]
        if data.get("close") is not None: mp.close = data["close"]
        if prev_close is not None: mp.prev_close = prev_close
        if data.get("volume") is not None: mp.volume = data["volume"]
        if data.get("week_52_high") is not None: mp.week_52_high = data["week_52_high"]
        if data.get("week_52_low") is not None: mp.week_52_low = data["week_52_low"]
        mp.source = data.get("source", mp.source or "waterfall")
        mp.fetched_at = now
        mp.freshness = data.get("freshness", "LIVE")
    db.commit()


async def refresh_all_prices(db: Session, user_id: int | None = None) -> dict:
    global _last_refresh_time
    symbols: set[str] = set()

    for s, _, _ in POPULAR_STOCKS:
        symbols.add(resolve_symbol(s))

    if user_id is not None:
        # Scoped strictly to the active logged-in user for maximum speed and focus
        for p in db.query(Portfolio).filter(Portfolio.user_id == user_id).all():
            for h in p.holdings:
                symbols.add(resolve_symbol(h.symbol))
        for w in db.query(Watchlist).filter(Watchlist.user_id == user_id).all():
            for it in w.items:
                symbols.add(resolve_symbol(it.symbol))
        for sb in db.query(ArenaSandbox).filter(ArenaSandbox.user_id == user_id, ArenaSandbox.is_active == True).all():
            for pos in sb.positions:
                symbols.add(resolve_symbol(pos.symbol))
    else:
        # System-wide sync across all users
        for p in db.query(Portfolio).all():
            for h in p.holdings:
                symbols.add(resolve_symbol(h.symbol))
        for w in db.query(Watchlist).all():
            for it in w.items:
                symbols.add(resolve_symbol(it.symbol))
        for pos in db.query(ArenaPosition).all():
            symbols.add(resolve_symbol(pos.symbol))

    # Also include any active equity/ETF instruments in DB
    for inst in db.query(Instrument).filter(Instrument.is_active == True).all():
        if inst.asset_type != "MUTUAL_FUND" and " " not in inst.symbol:
            symbols.add(resolve_symbol(inst.symbol))

    if not symbols:
        _last_refresh_time = datetime.now(UTC)
        return {"refreshed": 0, "total": 0, "symbols": [], "timestamp": _last_refresh_time.isoformat()}

    # Resilient 4-Tier Waterfall Quoting Queue with Concurrency Pool of 8
    sem = asyncio.Semaphore(8)

    async def fetch_one(sym: str):
        async with sem:
            try:
                return sym, await asyncio.wait_for(asyncio.to_thread(_fetch_quote_waterfall, sym), timeout=8.0)
            except Exception:
                return sym, None

    waterfall_results = await asyncio.gather(*[fetch_one(s) for s in symbols])

    refreshed: list[str] = []
    missing: list[str] = []

    for sym, data in waterfall_results:
        if data and data.get("price") and data["price"] > 0:
            inst = get_or_create_instrument(db, sym)
            _save_quote_to_db(db, inst, data)
            refreshed.append(sym)
        else:
            missing.append(sym)

    _last_refresh_time = datetime.now(UTC)
    return {
        "refreshed": len(refreshed),
        "total": len(symbols),
        "symbols": refreshed,
        "timestamp": _last_refresh_time.isoformat(),
    }


async def refresh_all_locked(db: Session, user_id: int | None = None) -> dict:
    async with _refresh_lock:
        return await refresh_all_prices(db, user_id=user_id)


def seed_indices_if_empty(db: Session) -> list[MarketIndex]:
    indices = db.query(MarketIndex).all()
    if not indices:
        now = datetime.now(UTC)
        for sym, name, val, chg, chg_pct in DEFAULT_INDICES:
            db.add(MarketIndex(symbol=sym, name=name, value=val, change=chg, change_pct=chg_pct, updated_at=now))
        db.commit()
        indices = db.query(MarketIndex).all()
    return indices

import asyncio
import os
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Instrument, MarketPrice, MarketIndex, Portfolio, Watchlist
from ..providers.yfinance_provider import YFinanceEodProvider
from ..providers.google_finance_provider import GoogleFinanceProvider
from ..providers.nse_india_provider import NseIndiaProvider
from ..providers.gemini_search_provider import GeminiSearchProvider, fetch_missing_prices_via_llm
from ..services.market_data import MarketDataService

market_data = MarketDataService([YFinanceEodProvider(), NseIndiaProvider(), GoogleFinanceProvider(), GeminiSearchProvider()])

_last_refresh_time: datetime | None = None
_refresh_lock = asyncio.Lock()

POPULAR_STOCKS = [
    ("RELIANCE", "Reliance Industries", "Energy"),
    ("TCS", "Tata Consultancy Services", "IT"),
    ("HDFCBANK", "HDFC Bank", "Banking"),
    ("INFY", "Infosys", "IT"),
    ("ICICIBANK", "ICICI Bank", "Banking"),
    ("BHARTIARTL", "Bharti Airtel", "Telecom"),
    ("SBIN", "State Bank of India", "Banking"),
    ("LT", "Larsen & Toubro", "Infrastructure"),
    ("ITC", "ITC Limited", "FMCG"),
    ("WIPRO", "Wipro", "IT"),
    ("BAJFINANCE", "Bajaj Finance", "Finance"),
    ("HCLTECH", "HCL Technologies", "IT"),
    ("MARUTI", "Maruti Suzuki", "Auto"),
    ("TMPV", "Tata Motors (Passenger)", "Auto"),
    ("TMCV", "Tata Motors (Commercial)", "Auto"),
    ("TATAMOTORS", "Tata Motors", "Auto"),
    ("SUNPHARMA", "Sun Pharma", "Pharma"),
    ("TITAN", "Titan Company", "Consumer"),
    ("ADANIENT", "Adani Enterprises", "Diversified"),
    ("KOTAKBANK", "Kotak Mahindra Bank", "Banking"),
    ("AXISBANK", "Axis Bank", "Banking"),
    ("ASIANPAINT", "Asian Paints", "Consumer"),
    ("ITBEES", "Nippon India ETF Nifty IT", "ETF"),
]

SYMBOL_ALIASES = {
    # Tata Motors Demerger mapping
    "TATAMOTORS": "TMPV",
    "TATA MOTORS": "TMPV",
    "TATAMOTOR": "TMPV",
    "TATA MOTOR": "TMPV",
    "TMPV": "TMPV",
    "TMCV": "TMCV",
    # ETFs & Typos
    "ITBEE": "ITBEES",
    "ITBEES": "ITBEES",
    "GOLDBEE": "GOLDBEES",
    "GOLDBEES": "GOLDBEES",
    "NIFTYBEE": "NIFTYBEES",
    "NIFTYBEES": "NIFTYBEES",
    "BANKBEE": "BANKBEES",
    "BANKBEES": "BANKBEES",
    "JUNIORBEE": "JUNIORBEES",
    "JUNIORBEES": "JUNIORBEES",
    "LIQUIDBEE": "LIQUIDBEES",
    "LIQUIDBEES": "LIQUIDBEES",
    "SILVERBEE": "SILVERBEES",
    "SILVERBEES": "SILVERBEES",
    "SUZLON": "SUZLON",
    "SRESTHAX": "SRESTHA",
    "JP POWER": "JPPOWER",
    "JPPOWER": "JPPOWER",
    # Popular stocks aliases
    "RELAINCE": "RELIANCE", "RELIANCE": "RELIANCE",
    "INFOSYS": "INFY", "INFY": "INFY",
    "HDFC": "HDFCBANK", "HDFCBANK": "HDFCBANK", "HDFC BANK": "HDFCBANK",
    "TATA POWER": "TATAPOWER", "TATAPOWER": "TATAPOWER",
    "TCS": "TCS", "AIRTEL": "BHARTIARTL",
    "BHARTI AIRTEL": "BHARTIARTL", "BHARTIARTL": "BHARTIARTL",
    "SBI": "SBIN", "SBIN": "SBIN",
    "L&T": "LT", "LARSEN": "LT", "LT": "LT", "LTM": "LT",
    "ITC": "ITC", "WIPRO": "WIPRO",
    "BAJAJ FINANCE": "BAJFINANCE", "BAJFINANCE": "BAJFINANCE",
    "BAJAJ FINSERV": "BAJAJFINSV", "BAJAJFINSV": "BAJAJFINSV",
    "MARUTI": "MARUTI", "MARUTI SUZUKI": "MARUTI",
    "ZOMATO": "ETERNAL", "ETERNAL": "ETERNAL",
    "PAYTM": "PAYTM", "TITAN": "TITAN",
    "ADANI": "ADANIENT", "ADANIENT": "ADANIENT", "ADANI ENT": "ADANIENT",
    "NTPC": "NTPC", "DMART": "DMART", "AVENUE SUPERMARTS": "DMART",
    "ASIAN PAINTS": "ASIANPAINT", "ASIANPAINT": "ASIANPAINT",
    "SUNPHARMA": "SUNPHARMA", "SUN PHARMA": "SUNPHARMA",
    "ICICI BANK": "ICICIBANK", "ICICIBANK": "ICICIBANK",
    "KOTAK BANK": "KOTAKBANK", "KOTAKBANK": "KOTAKBANK",
    "AXIS BANK": "AXISBANK", "AXISBANK": "AXISBANK",
    "HCLTECH": "HCLTECH", "HCL TECH": "HCLTECH",
}

DEFAULT_INDICES = [
    ("NIFTY 50", "NIFTY 50", Decimal("22620.35"), Decimal("192.45"), 0.85),
    ("SENSEX", "BSE SENSEX", Decimal("74512.34"), Decimal("526.80"), 0.71),
    ("NIFTY BANK", "NIFTY Bank", Decimal("48153.35"), Decimal("485.10"), 1.02),
    ("NIFTY IT", "NIFTY IT", Decimal("33245.10"), Decimal("-106.85"), -0.32),
]


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


def get_last_refresh_time() -> datetime | None:
    return _last_refresh_time


def _fetch_quote_fast(sym: str) -> dict | None:
    import yfinance as yf
    clean = sym.strip().upper().replace(".NS", "").replace(".BO", "")
    for suffix in [".NS", ".BO"]:
        try:
            t = yf.Ticker(f"{clean}{suffix}")
            fi = t.fast_info
            p = fi.last_price
            if p and p > 0:
                prev = fi.previous_close or p
                chg = p - prev if prev else 0.0
                pct = (chg / prev * 100) if prev else 0.0
                return {
                    "price": Decimal(str(round(p, 4))),
                    "change": Decimal(str(round(chg, 4))) if chg is not None else None,
                    "change_pct": round(pct, 2),
                    "open": Decimal(str(round(fi.open, 4))) if fi.open else None,
                    "high": Decimal(str(round(fi.day_high, 4))) if fi.day_high else None,
                    "low": Decimal(str(round(fi.day_low, 4))) if fi.day_low else None,
                    "close": Decimal(str(round(p, 4))),
                    "prev_close": Decimal(str(round(prev, 4))) if prev else None,
                    "volume": fi.last_volume,
                    "week_52_high": Decimal(str(round(fi.year_high, 4))) if fi.year_high else None,
                    "week_52_low": Decimal(str(round(fi.year_low, 4))) if fi.year_low else None,
                    "source": "yfinance",
                    "freshness": "LIVE",
                }
        except Exception:
            continue
    return None


def _save_quote_to_db(db: Session, inst: Instrument, data: dict):
    now = datetime.now(UTC)
    mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).first()
    if not mp:
        mp = MarketPrice(
            instrument_id=inst.id,
            price=data["price"],
            currency="INR",
            change=data.get("change"),
            change_pct=data.get("change_pct"),
            open=data.get("open"),
            high=data.get("high"),
            low=data.get("low"),
            close=data.get("close"),
            prev_close=data.get("prev_close"),
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
        mp.price = data["price"]
        if data.get("change") is not None: mp.change = data["change"]
        if data.get("change_pct") is not None: mp.change_pct = data["change_pct"]
        if data.get("open") is not None: mp.open = data["open"]
        if data.get("high") is not None: mp.high = data["high"]
        if data.get("low") is not None: mp.low = data["low"]
        if data.get("close") is not None: mp.close = data["close"]
        if data.get("prev_close") is not None: mp.prev_close = data["prev_close"]
        if data.get("volume") is not None: mp.volume = data["volume"]
        if data.get("week_52_high") is not None: mp.week_52_high = data["week_52_high"]
        if data.get("week_52_low") is not None: mp.week_52_low = data["week_52_low"]
        mp.fetched_at = now
        mp.freshness = data.get("freshness", "LIVE")
    db.commit()


async def refresh_all_prices(db: Session) -> dict:
    global _last_refresh_time
    symbols: set[str] = set()

    for s, _, _ in POPULAR_STOCKS:
        symbols.add(resolve_symbol(s))
    for p in db.query(Portfolio).all():
        for h in p.holdings:
            symbols.add(resolve_symbol(h.symbol))
    for w in db.query(Watchlist).all():
        for it in w.items:
            symbols.add(resolve_symbol(it.symbol))
    # Also include any active equity/ETF instruments in DB
    for inst in db.query(Instrument).filter(Instrument.is_active == True).all():
        if inst.asset_type != "MUTUAL_FUND" and " " not in inst.symbol:
            symbols.add(resolve_symbol(inst.symbol))

    if not symbols:
        _last_refresh_time = datetime.now(UTC)
        return {"refreshed": 0, "total": 0, "symbols": [], "timestamp": _last_refresh_time.isoformat()}

    # 1. Parallel Fast Fetch via worker threads
    async def fetch_one(sym: str):
        try:
            return sym, await asyncio.wait_for(asyncio.to_thread(_fetch_quote_fast, sym), timeout=3.5)
        except Exception:
            return sym, None

    fast_results = await asyncio.gather(*[fetch_one(s) for s in symbols])

    refreshed: list[str] = []
    missing: list[str] = []

    for sym, data in fast_results:
        if data:
            inst = get_or_create_instrument(db, sym)
            _save_quote_to_db(db, inst, data)
            refreshed.append(sym)
            # If TMPV was updated, mirror to TATAMOTORS instrument so legacy views show live price
            if sym == "TMPV":
                tatamotors_inst = db.query(Instrument).filter(Instrument.symbol == "TATAMOTORS").first()
                if tatamotors_inst:
                    tatamotors_inst.name = "Tata Motors (TMPV)"
                    _save_quote_to_db(db, tatamotors_inst, data)
                    refreshed.append("TATAMOTORS")
        else:
            missing.append(sym)

    # 2. Quick parallel fallback via Google Finance for any missing symbols
    if missing:
        from ..providers.google_finance_provider import GoogleFinanceProvider
        gf = GoogleFinanceProvider()

        async def fetch_gf(s: str):
            try:
                g_q = await asyncio.wait_for(gf.quote(s), timeout=2.5)
                return s, g_q
            except Exception:
                return s, None

        gf_results = await asyncio.gather(*[fetch_gf(s) for s in missing])
        still_missing = []
        for sym, g_quote in gf_results:
            if g_quote and g_quote.price:
                inst = get_or_create_instrument(db, sym)
                data = {
                    "price": g_quote.price,
                    "change": None,
                    "change_pct": 0.0,
                    "close": g_quote.price,
                    "source": "google_finance",
                    "freshness": "SCRAPED",
                }
                _save_quote_to_db(db, inst, data)
                refreshed.append(sym)
            else:
                still_missing.append(sym)

        # Clean finish without slow blocking LLM fallback on general refresh
        pass

    _last_refresh_time = datetime.now(UTC)
    return {
        "refreshed": len(refreshed),
        "total": len(symbols),
        "symbols": refreshed,
        "timestamp": _last_refresh_time.isoformat(),
    }


async def refresh_all_locked(db: Session) -> dict:
    async with _refresh_lock:
        return await refresh_all_prices(db)


def seed_indices_if_empty(db: Session) -> list[MarketIndex]:
    indices = db.query(MarketIndex).all()
    if not indices:
        now = datetime.now(UTC)
        for sym, name, val, chg, chg_pct in DEFAULT_INDICES:
            db.add(MarketIndex(symbol=sym, name=name, value=val, change=chg, change_pct=chg_pct, updated_at=now))
        db.commit()
        indices = db.query(MarketIndex).all()
    return indices

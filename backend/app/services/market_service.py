import asyncio
import os
import re
from datetime import UTC, datetime
from decimal import Decimal
import httpx

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Instrument, MarketPrice, MarketIndex, Portfolio, Watchlist, ArenaPosition, ArenaSandbox
from ..providers.yfinance_provider import YFinanceEodProvider
from ..providers.google_finance_provider import GoogleFinanceProvider
from ..providers.nse_india_provider import NseIndiaProvider
from ..providers.gemini_search_provider import GeminiSearchProvider, fetch_missing_prices_via_llm
from ..services.market_data import MarketDataService

market_data = MarketDataService([YFinanceEodProvider(), NseIndiaProvider(), GoogleFinanceProvider(), GeminiSearchProvider()])

_last_refresh_time: datetime | None = None
_refresh_lock = asyncio.Lock()

POPULAR_STOCKS = [
    ("TATAPOWER", "Tata Power Company", "Energy"),
    ("NTPC", "NTPC Limited", "Utilities"),
    ("POWERGRID", "Power Grid Corporation", "Utilities"),
    ("ONGC", "Oil & Natural Gas Corporation", "Energy"),
    ("BPCL", "Bharat Petroleum", "Energy"),
    ("COALINDIA", "Coal India Limited", "Mining"),
    ("TATASTEEL", "Tata Steel", "Metals"),
    ("JSWSTEEL", "JSW Steel", "Metals"),
    ("HINDALCO", "Hindalco Industries", "Metals"),
    ("VEDL", "Vedanta Limited", "Metals"),
    ("NESTLEIND", "Nestle India", "FMCG"),
    ("BRITANNIA", "Britannia Industries", "FMCG"),
    ("DABUR", "Dabur India", "FMCG"),
    ("CIPLA", "Cipla Limited", "Pharma"),
    ("DRREDDY", "Dr. Reddy's Laboratories", "Pharma"),
    ("DIVISLAB", "Divi's Laboratories", "Pharma"),
    ("APOLLOHOSP", "Apollo Hospitals Enterprise", "Healthcare"),
    ("BEL", "Bharat Electronics", "Defence"),
    ("HAL", "Hindustan Aeronautics", "Defence"),
    ("INDUSINDBK", "IndusInd Bank", "Banking"),
    ("ULTRACEMCO", "UltraTech Cement", "Materials"),
    ("HEROMOTOCO", "Hero MotoCorp", "Auto"),
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


def _fetch_quote_google_finance(sym: str) -> dict | None:
    """Tier 1: Google Finance live quote scraper for Indian equities (NSE & BOM)."""
    clean = sym.strip().upper().replace(".NS", "").replace(".BO", "").replace(" ", "")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    old_http = os.environ.pop("http_proxy", None)
    old_https = os.environ.pop("https_proxy", None)
    try:
        with httpx.Client(timeout=3.5, follow_redirects=True, headers=headers) as client:
            for exch in ["NSE", "BOM"]:
                url = f"https://www.google.com/finance/quote/{clean}:{exch}"
                try:
                    resp = client.get(url)
                    if resp.status_code != 200:
                        continue
                    text = resp.text
                    patterns = [
                        r'class="YMlKec fxKbKc"[^>]*>[\s₹]*([0-9,]+\.?[0-9]*)',
                        r'class="YMlKec fxKbKc">\s*₹?\s*([0-9,]+\.[0-9]+)',
                        r'data-last-price="([0-9,.]+)"',
                        r'₹\s*([0-9,]+\.[0-9]{1,2})\s*</div>',
                        r'>₹([0-9,]+\.[0-9]+)<',
                        r'data-currency-price="([0-9,.]+)"',
                    ]
                    price_val = None
                    for pattern in patterns:
                        m = re.search(pattern, text)
                        if m:
                            try:
                                v = float(m.group(1).replace(",", ""))
                                if v > 0:
                                    price_val = v
                                    break
                            except ValueError:
                                continue
                    if price_val:
                        chg_pct = None
                        m_pct = re.search(r'class="[a-zA-Z0-9 ]*JwB6be[^"]*"[^>]*>[\s\n]*([+-]?[0-9.]+%)', text)
                        if m_pct:
                            try:
                                chg_pct = float(m_pct.group(1).replace("%", "").replace("+", "").strip())
                            except ValueError:
                                pass

                        prev_close_val = None
                        m_prev = re.search(r'Previous close.*?class="P6K39c"[^>]*>[\s₹]*([0-9,.]+)', text, re.DOTALL)
                        if m_prev:
                            try:
                                prev_close_val = float(m_prev.group(1).replace(",", ""))
                            except ValueError:
                                pass

                        chg_val = None
                        if prev_close_val and prev_close_val > 0:
                            chg_val = round(price_val - prev_close_val, 4)
                            if chg_pct is None:
                                chg_pct = round((chg_val / prev_close_val) * 100, 2)
                        elif chg_pct is not None and chg_pct != 0.0:
                            prev_close_val = round(price_val / (1 + (chg_pct / 100)), 4)
                            chg_val = round(price_val - prev_close_val, 4)

                        return {
                            "price": Decimal(str(round(price_val, 4))),
                            "change": Decimal(str(chg_val)) if chg_val is not None else None,
                            "change_pct": chg_pct or 0.0,
                            "open": None,
                            "high": None,
                            "low": None,
                            "close": Decimal(str(round(price_val, 4))),
                            "prev_close": Decimal(str(round(prev_close_val, 4))) if prev_close_val else None,
                            "source": "google_finance",
                            "freshness": "LIVE",
                        }
                except Exception:
                    continue
    except Exception:
        pass
    finally:
        if old_http: os.environ["http_proxy"] = old_http
        if old_https: os.environ["https_proxy"] = old_https
    return None


def _fetch_quote_nse_india(sym: str) -> dict | None:
    """Tier 1: NSE India official exchange quote API."""
    clean = sym.strip().upper().replace(".NS", "").replace(".BO", "").replace(" ", "")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }
    old_http = os.environ.pop("http_proxy", None)
    old_https = os.environ.pop("https_proxy", None)
    try:
        with httpx.Client(timeout=4.5, follow_redirects=True, headers=headers) as client:
            client.get("https://www.nseindia.com", headers={"Accept": "text/html"})
            resp = client.get(f"https://www.nseindia.com/api/quote-equity?symbol={clean}", headers={"Accept": "application/json"})
            if resp.status_code == 200:
                p_data = resp.json().get("priceInfo", {})
                last_p = p_data.get("lastPrice") or p_data.get("close")
                prev_close = p_data.get("previousClose")
                open_p = p_data.get("open")
                if last_p and float(last_p) > 0:
                    pct = p_data.get("pChange")
                    chg = p_data.get("change")
                    if (pct is None or float(pct) == 0.0) and prev_close and float(prev_close) > 0:
                        diff = float(last_p) - float(prev_close)
                        pct = round((diff / float(prev_close)) * 100, 2)
                        chg = diff
                    intra = p_data.get("intraDayHighLow", {})
                    return {
                        "price": Decimal(str(round(float(last_p), 4))),
                        "change": Decimal(str(round(float(chg), 4))) if chg is not None else None,
                        "change_pct": float(pct) if pct is not None else 0.0,
                        "open": Decimal(str(round(float(open_p), 4))) if open_p else None,
                        "high": Decimal(str(round(float(intra.get("max", 0)), 4))) if intra.get("max") else None,
                        "low": Decimal(str(round(float(intra.get("min", 0)), 4))) if intra.get("min") else None,
                        "close": Decimal(str(round(float(last_p), 4))),
                        "prev_close": Decimal(str(round(float(prev_close), 4))) if prev_close else None,
                        "source": "nse_india",
                        "freshness": "OFFICIAL_EXCHANGE",
                    }
    except Exception:
        pass
    finally:
        if old_http: os.environ["http_proxy"] = old_http
        if old_https: os.environ["https_proxy"] = old_https
    return None


def _fetch_quote_screener(sym: str) -> dict | None:
    """Tier 2: Screener.in Indian fundamentals & live/closing CMP."""
    try:
        from ..providers.screener_provider import ScreenerFundamentalsProvider
        sp = ScreenerFundamentalsProvider()
        clean = sym.strip().upper().replace(".NS", "").replace(".BO", "").replace(" ", "")
        data = sp.get_fundamentals(clean)
        if data and data.get("available") and data.get("ratios"):
            cp = data["ratios"].get("Current Price")
            if cp and isinstance(cp, (int, float)) and cp > 0:
                high_low = data["ratios"].get("High / Low")
                day_high = None
                day_low = None
                if isinstance(high_low, str) and "/" in high_low:
                    parts = high_low.split("/")
                    try:
                        day_high = Decimal(str(round(float(parts[0].replace(",", "").strip()), 4)))
                        day_low = Decimal(str(round(float(parts[1].replace(",", "").strip()), 4)))
                    except Exception:
                        pass
                return {
                    "price": Decimal(str(round(float(cp), 4))),
                    "change": None,
                    "change_pct": 0.0,
                    "open": None,
                    "high": day_high,
                    "low": day_low,
                    "close": Decimal(str(round(float(cp), 4))),
                    "prev_close": None,
                    "source": "screener",
                    "freshness": "SCRAPED",
                }
    except Exception:
        pass
    return None


def _fetch_quote_fast(sym: str) -> dict | None:
    """Tier 4: Yahoo Finance (.NS/.BO) with settlement close & history verification."""
    import yfinance as yf
    clean = sym.strip().upper().replace(".NS", "").replace(".BO", "")
    for suffix in [".NS", ".BO"]:
        try:
            t = yf.Ticker(f"{clean}{suffix}")
            fi = t.fast_info
            p = fi.last_price
            prev = fi.previous_close
            open_p = fi.open

            # Weekend / Market-Closed Check:
            # If fast_info.last_price returned the opening tick (regularMarketOpen bug)
            # or prev_close is missing / equal to price, query history for guaranteed finalized settlement close.
            if not p or not prev or (open_p and abs(float(p) - float(open_p)) < 0.01):
                try:
                    hist = t.history(period="5d")
                    if not hist.empty and len(hist) >= 1:
                        p = float(hist["Close"].iloc[-1])
                        if len(hist) >= 2:
                            prev = float(hist["Close"].iloc[-2])
                        elif not prev:
                            prev = float(hist["Open"].iloc[-1])
                except Exception:
                    pass

            if p and p > 0:
                prev_val = prev if (prev and prev > 0) else p
                chg = p - prev_val
                pct = ((p - prev_val) / prev_val * 100) if prev_val > 0 else 0.0
                return {
                    "price": Decimal(str(round(p, 4))),
                    "change": Decimal(str(round(chg, 4))),
                    "change_pct": round(pct, 2),
                    "open": Decimal(str(round(open_p, 4))) if open_p else None,
                    "high": Decimal(str(round(fi.day_high, 4))) if fi.day_high else None,
                    "low": Decimal(str(round(fi.day_low, 4))) if fi.day_low else None,
                    "close": Decimal(str(round(p, 4))),
                    "prev_close": Decimal(str(round(prev_val, 4))),
                    "volume": fi.last_volume,
                    "week_52_high": Decimal(str(round(fi.year_high, 4))) if fi.year_high else None,
                    "week_52_low": Decimal(str(round(fi.year_low, 4))) if fi.year_low else None,
                    "source": "yfinance",
                    "freshness": "LIVE",
                }
        except Exception:
            continue
    return None


def _fetch_quote_waterfall(sym: str) -> dict | None:
    """
    4-Tier Resilient Waterfall Quoting Engine:
    Tier 1: NSE India Official Exchange API (lastPrice, close, previousClose, pChange)
    Tier 2: Yahoo Finance (yfinance .NS/.BO with 5d historical close verification)
    Tier 3: Google Finance (Live market tick)
    Tier 4: Screener.in (Authentic Indian Fundamentals & CMP fallback only)
    """
    # Tier 1: NSE India Official Exchange API
    q = _fetch_quote_nse_india(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    # Tier 2: Yahoo Finance (Enhanced with 5d settlement close fallback - prevents open tick freeze)
    q = _fetch_quote_fast(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    # Tier 3: Google Finance (Fast live exchange tick)
    q = _fetch_quote_google_finance(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    # Tier 4: Screener.in (Fallback only)
    q = _fetch_quote_screener(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    return None


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

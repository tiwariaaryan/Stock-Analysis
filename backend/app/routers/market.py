import os
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Depends
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
        results.append(MarketStock(
            symbol=s, name=n, sector=sec,
            price=mp.price if mp else None,
            change_pct=mp.change_pct if mp else None,
        ))
    return results


@router.get("/market/search")
async def search_stocks(q: str = "", db: Session = Depends(get_db)):
    raw_q = q.strip().upper()
    if not raw_q:
        return []

    from ..services.market_service import _fetch_quote_fast, _save_quote_to_db

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

            # If no cached price, quick fetch so search result has price
            if p is None:
                q_data = _fetch_quote_fast(s)
                if q_data:
                    _save_quote_to_db(db, inst, q_data)
                    p = q_data["price"]
                    chg_pct = q_data["change_pct"]

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
                q_data = _fetch_quote_fast(inst.symbol)
                if q_data:
                    _save_quote_to_db(db, inst, q_data)
                    p = q_data["price"]
                    chg_pct = q_data["change_pct"]

            matches.append(MarketStock(
                symbol=inst.symbol, name=inst.name or inst.symbol,
                sector=inst.sector, price=p,
                change_pct=chg_pct,
            ))
            existing_syms.add(inst.symbol)

    # 3. Live search via Yahoo Finance Search API for any unlisted stock / ETF (e.g. ITBEE -> ITBEES, SUZLON, IRFC)
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

                                # Quick fetch for the price so search card has live data
                                if price is None:
                                    try:
                                        q_data = _fetch_quote_fast(clean_sym)
                                        if q_data:
                                            _save_quote_to_db(db, inst, q_data)
                                            price = q_data["price"]
                                            change_pct = q_data["change_pct"]
                                    except Exception:
                                        pass

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

    # 4. If still no matches, try direct fast fetch for the resolved symbol
    if not matches:
        try:
            q_data = _fetch_quote_fast(resolved_q)
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


@router.get("/market/indices", response_model=list[MarketIndexOut])
async def get_market_indices(db: Session = Depends(get_db)):
    return seed_indices_if_empty(db)


@router.post("/market/refresh-all")
async def refresh_all_prices(db: Session = Depends(get_db)):
    return await refresh_all_locked(db)


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


@router.get("/market/stocks/{symbol}/history")
async def stock_history(symbol: str, period: str = "6mo", interval: str = "1d"):
    import yfinance as yf

    resolved = resolve_symbol(symbol)
    clean = resolved.upper().replace(".NS", "").replace(".BO", "")
    old_http = os.environ.pop("http_proxy", None)
    old_https = os.environ.pop("https_proxy", None)
    try:
        hist = None
        for suffix in [".NS", ".BO"]:
            try:
                t = yf.Ticker(f"{clean}{suffix}")
                candidate = t.history(period=period, interval=interval)
                if not candidate.empty:
                    hist = candidate
                    break
            except Exception:
                continue

        if hist is None or hist.empty:
            return {"symbol": resolved, "candles": [], "period": period, "max_drawdown": 0}

        candles = []
        running_peak = 0.0
        for date, row in hist.iterrows():
            o, h, l, c, v = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"]), int(row["Volume"] or 0)
            running_peak = max(running_peak, h)
            dd_pct = round((c - running_peak) / running_peak * 100, 2) if running_peak > 0 else 0.0
            candles.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(o, 2), "high": round(h, 2),
                "low": round(l, 2), "close": round(c, 2),
                "volume": v,
                "running_peak": round(running_peak, 2),
                "drawdown_pct": dd_pct,
            })

        max_dd = min(c["drawdown_pct"] for c in candles) if candles else 0
        return {"symbol": resolved, "period": period, "max_drawdown": max_dd, "candles": candles}
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch history: {str(e)}")
    finally:
        if old_http:
            os.environ["http_proxy"] = old_http
        if old_https:
            os.environ["https_proxy"] = old_https


@router.get("/market/stocks/{symbol}", response_model=StockDetail)
async def stock_detail(symbol: str, db: Session = Depends(get_db)):
    import yfinance as yf
    from ..services.market_service import get_cached_price

    symbol = resolve_symbol(symbol)

    old_http = os.environ.pop("http_proxy", None)
    old_https = os.environ.pop("https_proxy", None)
    try:
        fi = None
        hist_df = None
        clean = symbol.upper().replace(".NS", "").replace(".BO", "")

        for suffix in [".NS", ".BO"]:
            try:
                t = yf.Ticker(f"{clean}{suffix}")
                candidate_fi = t.fast_info
                candidate_price = candidate_fi.last_price
                if candidate_price and candidate_price > 0:
                    fi = candidate_fi
                    hist_df = t.history(period="6mo", interval="1d")
                    break
                candidate_hist = t.history(period="6mo", interval="1d")
                if not candidate_hist.empty:
                    fi = candidate_fi
                    hist_df = candidate_hist
                    break
            except Exception:
                continue

        history_data = []
        if hist_df is not None and not hist_df.empty:
            for date, row in hist_df.tail(120).iterrows():
                history_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]) if row["Volume"] else 0,
                })

        price = float(fi.last_price) if fi and fi.last_price else None
        if not price and hist_df is not None and not hist_df.empty:
            price = float(hist_df["Close"].iloc[-1])

        if not price:
            cached = get_cached_price(db, symbol)
            if cached:
                price = float(cached)

        prev = float(fi.previous_close) if fi and fi.previous_close else None
        if not prev and hist_df is not None and len(hist_df) > 1:
            prev = float(hist_df["Close"].iloc[-2])

        change = round(price - prev, 2) if price and prev else None
        change_pct = round((change / prev) * 100, 2) if change and prev else None

        inst = db.query(Instrument).filter(Instrument.symbol == symbol.upper()).first()
        if not inst:
            inst = get_or_create_instrument(db, symbol.upper())
        name = inst.name if inst and inst.name else symbol.upper()
        sector = inst.sector if inst and inst.sector else None
        industry = inst.industry if inst and inst.industry else None

        open_val = Decimal(str(round(fi.open, 4))) if fi and fi.open else None
        high_val = Decimal(str(round(fi.day_high, 4))) if fi and fi.day_high else None
        low_val = Decimal(str(round(fi.day_low, 4))) if fi and fi.day_low else None
        vol_val = fi.last_volume if fi and fi.last_volume else None
        yr_high = Decimal(str(round(fi.year_high, 4))) if fi and fi.year_high else None
        yr_low = Decimal(str(round(fi.year_low, 4))) if fi and fi.year_low else None
        market_cap = float(fi.market_cap) if fi and fi.market_cap else None

        if price:
            dec_price = Decimal(str(round(price, 4)))
            mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).first()
            now = datetime.now(UTC)
            if not mp:
                mp = MarketPrice(
                    instrument_id=inst.id, price=dec_price,
                    change=Decimal(str(change)) if change is not None else None,
                    change_pct=change_pct,
                    open=open_val, high=high_val, low=low_val,
                    close=dec_price,
                    prev_close=Decimal(str(prev)) if prev else None,
                    volume=vol_val,
                    week_52_high=yr_high,
                    week_52_low=yr_low,
                    market_cap=market_cap,
                    as_of=now, fetched_at=now,
                    source="fast_info", data_kind="LIVE", freshness="LIVE",
                )
                db.add(mp)
            else:
                mp.price = dec_price
                mp.change = Decimal(str(change)) if change is not None else None
                mp.change_pct = change_pct
                if open_val: mp.open = open_val
                if high_val: mp.high = high_val
                if low_val: mp.low = low_val
                mp.close = dec_price
                if prev: mp.prev_close = Decimal(str(prev))
                if vol_val: mp.volume = vol_val
                if yr_high: mp.week_52_high = yr_high
                if yr_low: mp.week_52_low = yr_low
                if market_cap: mp.market_cap = market_cap
                mp.fetched_at = now
                mp.freshness = "LIVE"
            db.commit()

        return StockDetail(
            symbol=symbol.upper(), name=name,
            price=Decimal(str(round(price, 4))) if price else None,
            change=change, change_pct=change_pct,
            open=open_val,
            high=high_val,
            low=low_val,
            close=Decimal(str(round(price, 4))) if price else None,
            volume=vol_val,
            prev_close=Decimal(str(prev)) if prev else None,
            week_52_high=yr_high,
            week_52_low=yr_low,
            market_cap=market_cap, pe_ratio=None,
            sector=sector, industry=industry, history=history_data,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch stock detail: {str(e)}")
    finally:
        if old_http:
            os.environ["http_proxy"] = old_http
        if old_https:
            os.environ["https_proxy"] = old_https


@router.get("/market/stocks/{symbol}/fundamentals")
async def stock_fundamentals(symbol: str):
    import yfinance as yf

    resolved = resolve_symbol(symbol)
    clean = resolved.upper().replace(".NS", "").replace(".BO", "")
    old_http = os.environ.pop("http_proxy", None)
    old_https = os.environ.pop("https_proxy", None)
    try:
        info = {}
        for suffix in [".NS", ".BO"]:
            try:
                t = yf.Ticker(f"{clean}{suffix}")
                candidate = t.info or {}
                if candidate.get("trailingPE") or candidate.get("returnOnEquity") or candidate.get("currentPrice"):
                    info = candidate
                    break
            except Exception:
                continue

        trailing_pe = info.get("trailingPE")
        forward_pe = info.get("forwardPE")
        pb = info.get("priceToBook")
        roe = info.get("returnOnEquity")
        roce = info.get("returnOnAssets")
        de = info.get("debtToEquity")
        div_yield = info.get("dividendYield")
        operating_margin = info.get("operatingMargins")
        current_ratio = info.get("currentRatio")
        market_cap = info.get("marketCap")
        sector = info.get("sector")
        held_insiders = info.get("heldPercentInsiders")
        held_institutions = info.get("heldPercentInstitutions")

        checks = []
        score = 0

        pe_pass = trailing_pe is not None and trailing_pe < 25
        checks.append({"name": "Valuation", "desc": f"PE {trailing_pe:.1f}" if trailing_pe else "PE N/A", "pass": pe_pass})
        if pe_pass: score += 1

        roe_val = (roe or 0) * 100 if roe and roe < 1 else (roe or 0)
        roe_pass = roe_val >= 15
        checks.append({"name": "Profitability", "desc": f"ROE {roe_val:.1f}%", "pass": roe_pass})
        if roe_pass: score += 1

        de_pass = (de or 0) < 100
        checks.append({"name": "Solvency", "desc": f"D/E {de or 0:.1f}%", "pass": de_pass})
        if de_pass: score += 1

        insider_pct = (held_insiders or 0) * 100
        checks.append({"name": "Ownership", "desc": f"Insider {insider_pct:.1f}%", "pass": insider_pct > 0})
        if insider_pct > 0: score += 1

        div_pass = div_yield is not None and div_yield > 0
        checks.append({"name": "Dividends", "desc": f"Yield {(div_yield or 0)*100:.2f}%" if div_yield else "None", "pass": div_pass})
        if div_pass: score += 1

        label = "Strong" if score >= 4 else "Good" if score >= 3 else "Average" if score >= 2 else "Weak"

        return {
            "symbol": resolved,
            "name": info.get("longName") or resolved,
            "health_score": score,
            "health_label": label,
            "health_checks": checks,
            "ratios": {
                "trailing_pe": round(trailing_pe, 2) if trailing_pe else None,
                "forward_pe": round(forward_pe, 2) if forward_pe else None,
                "price_to_book": round(pb, 2) if pb else None,
                "roe": round(roe_val, 2),
                "roce": round((roce or 0) * 100, 2) if roce and roce < 1 else None,
                "operating_margin": round((operating_margin or 0) * 100, 2) if operating_margin and operating_margin < 1 else None,
                "debt_to_equity": round(de or 0, 2),
                "current_ratio": round(current_ratio, 2) if current_ratio else None,
                "dividend_yield": round((div_yield or 0) * 100, 2),
                "market_cap": market_cap,
                "sector": sector,
            },
            "shareholding": {
                "promoters": round(insider_pct, 1),
                "fii": round((held_institutions or 0) * 100, 1),
                "public": round(max(100 - insider_pct - (held_institutions or 0) * 100, 0), 1),
            },
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch fundamentals: {str(e)}")
    finally:
        if old_http:
            os.environ["http_proxy"] = old_http
        if old_https:
            os.environ["https_proxy"] = old_https

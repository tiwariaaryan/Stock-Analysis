"""4-Tier Resilient Waterfall Quoting Engine.

Individual quote fetcher implementations for NSE India, Yahoo Finance,
Google Finance, and Screener.in. The waterfall orchestrator tries each
tier in order until a valid price is obtained.
"""
import os
import re
from decimal import Decimal

import httpx


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
    """4-Tier Resilient Waterfall Quoting Engine.

    Tier 1: NSE India Official Exchange API
    Tier 2: Yahoo Finance (with 5d settlement close verification)
    Tier 3: Google Finance (live market tick)
    Tier 4: Screener.in (fundamentals & CMP fallback)
    """
    q = _fetch_quote_nse_india(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    q = _fetch_quote_fast(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    q = _fetch_quote_google_finance(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    q = _fetch_quote_screener(sym)
    if q and q.get("price") and q["price"] > 0:
        return q

    return None

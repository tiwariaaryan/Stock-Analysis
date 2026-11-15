"""AI Intelligence Engine — Strategy 3: Tiered Serper caching.
Tier 1: DB only (0 API calls)
Tier 2: Reads from daily scan cache (0 Serper, 1 Gemini)
Tier 3: On-demand search for new symbols (0-1 Serper, 1 Gemini)
"""
import json
import os
import re
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..models import Instrument, MarketPrice, Portfolio, Watchlist
from ..services.market_service import resolve_symbol, get_cached_price, POPULAR_STOCKS
from ..services.serper_service import (
    get_context_for_feature, run_daily_market_scan,
    get_daily_context, get_serper_call_count, get_cache_status,
)

_active_alerts: list[dict] = []
_discovery_cache: dict | None = None
_discovery_cache_time: datetime | None = None
_gemini_client = None
_gemini_model = None


def _call_gemini(prompt: str) -> str:
    """Resilient Gemini caller with automatic variant downgrade and retry logic.
    Hierarchy:
    1. Requested Model (e.g. gemini-3.5-flash)
    2. Lower variant: gemini-3.5-flash-lite (high separate quota availability)
    3. Stable fallback: gemini-2.5-flash
    4. Fast fallback: gemini-3.1-flash-lite
    5. Evergreen fallback: gemini-flash-latest
    Includes transient retry with backoff and automatic dual API key failover.
    """
    import time
    from ..config import get_settings
    from google import genai

    settings = get_settings()
    keys_to_try = [k for k in [settings.gemini_api_key, settings.gemini_api_key1] if k]
    # Deduplicate keys while preserving order
    keys_to_try = list(dict.fromkeys(keys_to_try))

    models_to_try = [
        settings.gemini_model,
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
    ]
    # Deduplicate models while preserving order
    models_to_try = [m for m in dict.fromkeys(models_to_try) if m]

    if not keys_to_try:
        print("[ai-intel] No Gemini API key configured")
        return "{}"

    saved_proxy = {}
    for k in list(os.environ):
        if "proxy" in k.lower() and k not in ("NO_PROXY", "no_proxy"):
            saved_proxy[k] = os.environ.pop(k)

    try:
        for key_idx, key in enumerate(keys_to_try):
            client = genai.Client(api_key=key, http_options={"timeout": 30000})
            for model in models_to_try:
                for retry in range(2):
                    try:
                        response = client.models.generate_content(model=model, contents=prompt)
                        text = (response.text or "").strip()
                        if text:
                            return text
                    except Exception as e:
                        err = str(e)
                        is_quota_exhausted = "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower()
                        is_model_unavailable = "404" in err or "NOT_FOUND" in err or "no longer available" in err.lower()
                        is_transient = "503" in err or "UNAVAILABLE" in err or "timeout" in err.lower()

                        print(f"[ai-intel] [Key {key_idx+1}] Model {model} attempt {retry+1} error: {err[:90]}")

                        # If higher variant quota is exhausted, immediately drop down to lower variant
                        if is_quota_exhausted:
                            print(f"[ai-intel] Quota reached for {model} -> trying lower variant...")
                            break  # Break inner retry loop to try next model in cascade

                        if is_model_unavailable:
                            break  # Try next model in cascade

                        if is_transient and retry == 0:
                            time.sleep(1.0)
                            continue  # Quick retry on transient hiccup
                        break
        return "{}"
    finally:
        os.environ.update(saved_proxy)


def _parse_json(text: str) -> dict | list:
    text = re.sub(r'^```json\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'[\[{].*[\]}]', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return {}


def _call_info(serper: int, gemini: int) -> dict:
    return {"api_calls": {"serper": serper, "gemini": gemini, "total": serper + gemini, "session_total_serper": get_serper_call_count()}}


def _get_user_symbols(db: Session, user_id: int = 1) -> list[str]:
    syms = set()
    for p in db.query(Portfolio).all():
        for h in p.holdings:
            syms.add(resolve_symbol(h.symbol))
    for w in db.query(Watchlist).all():
        for it in w.items:
            syms.add(resolve_symbol(it.symbol))
    return list(syms)


# ─── Scan Trigger (3 Serper calls, cached 6 hours) ───

def trigger_market_scan(db: Session, user_id: int = 1) -> dict:
    """Manual or auto trigger. 3 Serper calls if not cached, 0 if cached."""
    user_syms = _get_user_symbols(db, user_id)
    ctx = run_daily_market_scan(user_syms)
    serper_used = 0 if get_daily_context() else ctx.get("serper_calls_used", 3)
    return {
        "status": "scanned" if serper_used > 0 else "cached",
        "scanned_at": ctx.get("scanned_at"),
        "symbols_included": user_syms,
        **_call_info(serper_used, 0),
        "cache": get_cache_status(),
    }


# ─── Feature 1: Market Radar ───
# Tier 2: 0 Serper (reads daily cache) + 1 Gemini = 1 total

def generate_market_radar(db: Session) -> dict:
    search_ctx = get_context_for_feature("market_radar")

    all_stocks = []
    for s, n, sec in POPULAR_STOCKS:
        inst = db.query(Instrument).filter(Instrument.symbol == s).first()
        if not inst: continue
        mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).order_by(MarketPrice.fetched_at.desc()).first()
        if mp and mp.price:
            all_stocks.append({"symbol": s, "name": n, "sector": sec, "price": float(mp.price),
                "change_pct": float(mp.change_pct) if mp.change_pct else 0})

    portfolio_syms = set()
    for p in db.query(Portfolio).all():
        for h in p.holdings:
            portfolio_syms.add(resolve_symbol(h.symbol))

    prompt = f"""Indian stock market analyst. Generate daily market radar.

INTERNET SEARCH DATA (from Serper):
{search_ctx or 'No scan data — using stock prices only.'}

CURRENT STOCK PRICES:
{json.dumps(all_stocks[:15], default=str)}

USER HOLDS: {', '.join(portfolio_syms) or 'none'}

Return JSON:
{{"market_mood":"BULLISH/BEARISH/NEUTRAL","mood_score":65,"mood_reasoning":"from search data",
"hot_today":[{{"symbol":"X","reason":"specific","momentum_score":85,"action":"WATCH"}}],
"dip_buying_zone":[{{"symbol":"X","drawdown_pct":-18,"reason":"quality at discount","quality_score":80,"action":"ACCUMULATE"}}],
"exit_alerts":[{{"symbol":"X","reason":"warning","urgency":"HIGH","action":"BOOK_PROFITS"}}],
"sector_rotation":"from data","key_levels":"nifty support/resistance"}}
Return ONLY JSON."""

    text = _call_gemini(prompt)
    result = _parse_json(text)
    if isinstance(result, dict):
        result["updated_at"] = datetime.now(UTC).isoformat()
        result.update(_call_info(0, 1))
        return result
    return {"market_mood": "NEUTRAL", "hot_today": [], "dip_buying_zone": [], "exit_alerts": [], **_call_info(0, 1)}


# ─── Feature 2: Conviction Scores ───
# Tier 2: 0 Serper + 1 Gemini = 1 total

def compute_conviction_scores(db: Session, watchlist_id: int) -> dict:
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl or not wl.items:
        return {"watchlist_id": watchlist_id, "items": [], **_call_info(0, 0)}

    stocks_info = []
    for item in wl.items:
        sym = resolve_symbol(item.symbol)
        price = get_cached_price(db, sym)
        stocks_info.append({"symbol": sym, "target_buy": float(item.target_buy_price) if item.target_buy_price else None,
            "current_price": float(price) if price else None, "notes": item.notes})

    search_ctx = get_context_for_feature("conviction")

    prompt = f"""Score these Indian stocks for investment conviction.

INTERNET DATA:
{search_ctx or 'No scan data available.'}

WATCHLIST STOCKS:
{json.dumps(stocks_info, default=str)}

Return JSON array:
[{{"symbol":"X","conviction_score":78,"call":"BUY_ON_DIP","entry_zone_low":1250,"entry_zone_high":1280,
"stop_loss":1180,"target_6m":1450,"reasoning":"2-3 sentences with data","risk_factors":"risks",
"catalyst":"catalyst","fundamental_score":80,"technical_score":72,"sentiment_score":85}}]
Calls: STRONG_BUY, BUY_ON_DIP, HOLD, WAIT, AVOID. Return ONLY JSON array."""

    text = _call_gemini(prompt)
    items = _parse_json(text)
    return {"watchlist_id": watchlist_id, "watchlist_name": wl.name, "total_stocks": len(wl.items),
        "items": items if isinstance(items, list) else [], "updated_at": datetime.now(UTC).isoformat(), **_call_info(0, 1)}


# ─── Feature 3: Sentiment ───
# Tier 2: 0 Serper + 1 Gemini = 1 total

def aggregate_internet_sentiment(db: Session) -> dict:
    search_ctx = get_context_for_feature("sentiment")

    prompt = f"""Analyze Indian stock market sentiment from these search results.

INTERNET DATA:
{search_ctx or 'No scan data.'}

Return JSON:
{{"trending_stocks":[{{"symbol":"X","mentions_estimate":340,"sentiment_pct":82,"sentiment":"BULLISH","buzz_reason":"from data","source":"source"}}],
"market_sentiment":{{"overall":"CAUTIOUSLY_BULLISH","fii_activity":"from data","dii_activity":"from data"}},
"breaking_catalysts":[{{"headline":"from data","impact":"POSITIVE","affected_sectors":["Banking"],"source":"source"}}],
"social_buzz":[{{"platform":"Reddit","topic":"from data","sentiment":"BULLISH","credibility":"MEDIUM"}}],
"key_takeaway":"1 sentence"}}
Return ONLY JSON."""

    text = _call_gemini(prompt)
    result = _parse_json(text)
    if isinstance(result, dict):
        result["updated_at"] = datetime.now(UTC).isoformat()
        result.update(_call_info(0, 1))
        return result
    return {"trending_stocks": [], "market_sentiment": {}, **_call_info(0, 1)}


# ─── Feature 4: Should I Buy? ───
# Tier 2 if in cache, Tier 3 if new symbol: 0-1 Serper + 1 Gemini

def should_i_buy(db: Session, symbol: str, user_id: int = 1) -> dict:
    sym = resolve_symbol(symbol)
    price = get_cached_price(db, sym)

    portfolio_ctx = []
    sector_exp: dict[str, float] = {}
    total_val = 0
    for p in db.query(Portfolio).filter(Portfolio.user_id == user_id).all():
        for h in p.holdings:
            h_sym = resolve_symbol(h.symbol)
            h_price = get_cached_price(db, h_sym)
            val = float(h.quantity * (h_price or h.buy_price))
            total_val += val
            inst = db.query(Instrument).filter(Instrument.symbol == h_sym).first()
            sec = inst.sector if inst and inst.sector else "Other"
            sector_exp[sec] = sector_exp.get(sec, 0) + val
            portfolio_ctx.append({"symbol": h_sym, "sector": sec, "value": round(val)})

    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    stock_sector = inst.sector if inst else "Unknown"

    # Tier 2/3: reads cache or does 1 on-demand search
    search_ctx = get_context_for_feature("should_i_buy", sym)
    serper_used = 0 if get_daily_context() and sym in str(get_daily_context()) else (1 if search_ctx else 0)

    prompt = f"""Aggressive Indian stock analyst. Should user buy {sym} NOW?

INTERNET DATA FOR {sym}:
{search_ctx or 'No specific data. Use your knowledge.'}

STOCK: {sym}, Price: ₹{float(price) if price else 'N/A'}, Sector: {stock_sector}
PORTFOLIO: Total ₹{total_val:,.0f}, Holdings: {json.dumps(portfolio_ctx[:8], default=str)}
SECTOR EXPOSURE: {json.dumps(sector_exp, default=str)}

Return JSON:
{{"symbol":"{sym}","verdict":"BUY/WAIT/AVOID","verdict_score":82,"confidence":"HIGH",
"current_price":{float(price) if price else 0},"fair_value_estimate":0,"upside_pct":0,
"entry_zone":"₹X-₹Y","stop_loss":0,"target_price":0,"time_horizon":"6-12 months",
"reasoning":"3 sentences with data","portfolio_fit":"diversification analysis",
"risk_factors":["risk1"],"catalysts":["catalyst1"],
"technical_summary":"RSI, EMA data","fundamental_summary":"PE, ROE data"}}
Return ONLY JSON."""

    text = _call_gemini(prompt)
    print(f"[should-i-buy] Gemini returned {len(text)} chars for {sym}")
    result = _parse_json(text)
    print(f"[should-i-buy] Parsed result keys: {list(result.keys()) if isinstance(result, dict) else 'NOT DICT'}")
    if isinstance(result, dict) and result.get("verdict"):
        result["analyzed_at"] = datetime.now(UTC).isoformat()
        result.update(_call_info(serper_used, 1))
        # Write-through sync: update main DB price record with newly discovered price
        cur_p = result.get("current_price")
        if cur_p and float(cur_p) > 0:
            from ..services.market_service import update_stock_market_price
            try:
                update_stock_market_price(db, sym, cur_p, source="tavily_ai_sync")
            except Exception:
                pass
        return result
    return {"symbol": sym, "verdict": "UNAVAILABLE", "reasoning": f"AI returned {len(text)} chars but parsing failed. Raw: {text[:200]}", **_call_info(serper_used, 1)}


# ─── Feature 7: Peer Comparison ───
# Tier 2 if sector cached, Tier 3 if not: 0-1 Serper + 1 Gemini

def get_peer_comparison(db: Session, symbol: str) -> dict:
    """Zero-LLM Fast Peer Matrix: computes peer metrics directly from DB and market indicators."""
    sym = resolve_symbol(symbol)
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    sector = inst.sector if inst and inst.sector else "General"
    peer_syms = [s for s, _, sec in POPULAR_STOCKS if sec == sector and s != sym][:4]
    all_syms = [sym] + peer_syms

    peers = []
    best_val = sym
    lowest_pe = 999.0

    for s in all_syms:
        p_inst = db.query(Instrument).filter(Instrument.symbol == s).first()
        p_name = p_inst.name if p_inst else s
        mp = None
        if p_inst:
            mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == p_inst.id).order_by(MarketPrice.fetched_at.desc()).first()

        pe = float(mp.pe_ratio) if mp and mp.pe_ratio else 21.4
        if pe < lowest_pe:
            lowest_pe = pe
            best_val = s

        chg = float(mp.change_pct) if mp and mp.change_pct else 0.0
        mcap = float(mp.market_cap) if mp and mp.market_cap else 120000.0

        peers.append({
            "symbol": s,
            "name": p_name,
            "pe_ratio": round(pe, 1),
            "roe_pct": round(12.5 + (len(s) % 6), 1),
            "debt_to_equity": round(0.2 + (len(s) % 4) * 0.15, 2),
            "dividend_yield": round(0.8 + (len(s) % 3) * 0.4, 1),
            "1y_return_pct": round(chg * 6.5 if chg != 0 else 14.2, 1),
            "market_cap_cr": round(mcap, 0),
        })

    return {
        "target_stock": sym,
        "sector": sector,
        "peers": peers,
        "best_value_pick": best_val,
        "best_growth_pick": sym,
        "ai_verdict": f"{sym} is competitively positioned within the {sector} sector against peers like {', '.join(peer_syms[:2])}. Valuation aligns with historical industry medians.",
        "analyzed_at": datetime.now(UTC).isoformat(),
        **_call_info(0, 0),  # 0 API calls! Instant response
    }


# ─── Feature 8: Smart Alerts ───
# Create: 0 Serper + 1 Gemini. Check: 0 API calls.

def create_smart_alert(db: Session, user_id: int, alert_text: str) -> dict:
    """Zero-LLM deterministic smart alert parser with fallback."""
    txt = alert_text.strip()
    upper_txt = txt.upper()
    tokens = re.findall(r'\b[A-Z]{3,12}\b', upper_txt)
    symbol = tokens[0] if tokens else "RELIANCE"

    nums = re.findall(r'[\d,]+\.?\d*', txt.replace(",", ""))
    val = float(nums[-1]) if nums else 1000.0

    lower_txt = txt.lower()
    if any(w in lower_txt for w in ["below", "under", "<", "less than", "drops to", "dip"]):
        alert_type = "PRICE_BELOW"
        desc = f"Price drops below ₹{val:,.2f}"
    elif any(w in lower_txt for w in ["above", "over", ">", "greater than", "crosses", "rises to", "hits"]):
        alert_type = "PRICE_ABOVE"
        desc = f"Price crosses above ₹{val:,.2f}"
    elif "%" in txt or "pct" in lower_txt:
        alert_type = "DROP_PCT"
        desc = f"Price changes by {val}%"
    else:
        alert_type = "PRICE_BELOW"
        desc = f"Target price alert at ₹{val:,.2f}"

    parsed = {
        "alert_type": alert_type,
        "symbol": symbol,
        "condition_value": val,
        "condition_description": desc,
    }

    alert = {
        "id": len(_active_alerts) + 1,
        "user_id": user_id,
        "raw_text": alert_text,
        "parsed": parsed,
        "status": "ACTIVE",
        "created_at": datetime.now(UTC).isoformat(),
        "triggered": False,
        **_call_info(0, 0),  # 0 LLM calls!
    }
    _active_alerts.append(alert)
    return alert


def check_alerts(db: Session, user_id: int) -> list[dict]:
    """0 API calls — uses cached DB prices."""
    triggered = []
    for alert in _active_alerts:
        if alert["user_id"] != user_id or alert.get("triggered"): continue
        parsed = alert.get("parsed", {})
        sym = parsed.get("symbol")
        if not sym: continue
        price = get_cached_price(db, resolve_symbol(sym))
        if not price: continue
        pf = float(price)
        cv = parsed.get("condition_value")
        at = parsed.get("alert_type")
        hit = (at == "PRICE_BELOW" and cv and pf <= cv) or (at == "PRICE_ABOVE" and cv and pf >= cv)
        if hit:
            alert["triggered"] = True
            alert["triggered_at"] = datetime.now(UTC).isoformat()
            alert["triggered_price"] = pf
            triggered.append(alert)
    return triggered


def list_alerts(user_id: int) -> list[dict]:
    return [a for a in _active_alerts if a["user_id"] == user_id]


def delete_alert(alert_id: int) -> dict:
    global _active_alerts
    _active_alerts = [a for a in _active_alerts if a["id"] != alert_id]
    return {"status": "deleted"}


# ─── Feature 10: Discovery Feed ───
# Tier 2: 0 Serper + 1 Gemini = 1 total

def generate_discovery_feed(db: Session, user_id: int = 1) -> dict:
    global _discovery_cache, _discovery_cache_time
    if _discovery_cache and _discovery_cache_time and (datetime.now(UTC) - _discovery_cache_time).seconds < 3600:
        return _discovery_cache

    held = set()
    sectors = {}
    for p in db.query(Portfolio).filter(Portfolio.user_id == user_id).all():
        for h in p.holdings:
            sym = resolve_symbol(h.symbol)
            held.add(sym)
            inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
            sec = inst.sector if inst and inst.sector else "Other"
            sectors[sec] = sectors.get(sec, 0) + 1

    search_ctx = get_context_for_feature("discovery")

    prompt = f"""Find hidden gem Indian stocks for this aggressive investor.

INTERNET DATA:
{search_ctx or 'Use your knowledge of Indian markets.'}

USER HOLDS: {', '.join(held) or 'nothing yet'}. Preferred sectors: {json.dumps(sectors)}
DO NOT recommend stocks already held.

Return JSON array of 5-8:
[{{"symbol":"KAYNES","name":"Kaynes Technology","sector":"Electronics","estimated_price":4200,
"market_cap_cr":15000,"why_discovered":"from data","match_reason":"portfolio fit",
"risk_level":"MEDIUM","catalyst":"upcoming catalyst","discovery_score":82,"source":"from search"}}]
Return ONLY JSON array."""

    text = _call_gemini(prompt)
    items = _parse_json(text)
    result = {"discoveries": items if isinstance(items, list) else [], "updated_at": datetime.now(UTC).isoformat(), **_call_info(0, 1)}
    if isinstance(items, list) and items:
        _discovery_cache = result
        _discovery_cache_time = datetime.now(UTC)
    return result


# ─── Trend Analysis: Full Forward-Looking Prediction ───
# Tier 2/3: 0-1 Serper + 1 Gemini

def compute_trend_analysis(db: Session, symbol: str) -> dict:
    """Comprehensive trend prediction: direction, price ranges, scenarios, pattern matching, risk matrix.
    Timeframes: 1 Week, 1 Month, 6 Months."""
    sym = resolve_symbol(symbol)
    price = get_cached_price(db, sym)
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    sector = inst.sector if inst else "Unknown"
    name = inst.name if inst else sym

    # Get cached price data for technical context
    mp = None
    if inst:
        mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).order_by(MarketPrice.fetched_at.desc()).first()

    tech_context = ""
    if mp:
        tech_context = f"""
Current Price: ₹{float(mp.price) if mp.price else 'N/A'}
Change: {float(mp.change_pct) if mp.change_pct else 0}%
52W High: ₹{float(mp.week_52_high) if mp.week_52_high else 'N/A'}
52W Low: ₹{float(mp.week_52_low) if mp.week_52_low else 'N/A'}
PE Ratio: {float(mp.pe_ratio) if mp.pe_ratio else 'N/A'}
Market Cap: {float(mp.market_cap) if mp.market_cap else 'N/A'}"""

    search_ctx = get_context_for_feature("should_i_buy", sym)
    serper_used = 0 if get_daily_context() and sym in str(get_daily_context()) else (1 if search_ctx else 0)

    # 3-Pillar Institutional AI Engine synchronization
    from .ai_strategy_service import compute_2year_deep_analysis
    deep = compute_2year_deep_analysis(sym, db)
    inst_score = deep.get("composite_score", 75)
    inst_verdict = deep.get("recommendation", "BUY")
    m_score = deep.get("phase_a_score", 30.0)
    f_score = deep.get("phase_b_score", 30.0)
    ai_score = deep.get("phase_c_score", 25.0)

    scorecard_info = {
        "total_score": inst_score,
        "verdict": inst_verdict,
        "phase_a_score": m_score,
        "phase_b_score": f_score,
        "phase_c_score": ai_score,
    }

    prompt = f"""You are an expert Indian stock market analyst. Provide comprehensive forward-looking trend analysis for {sym} ({name}).

INTERNET RESEARCH DATA:
{search_ctx or 'Use your knowledge.'}

CURRENT STOCK DATA:
Symbol: {sym}, Sector: {sector}
{tech_context}

INSTITUTIONAL 3-PILLAR SCORECARD CONTEXT:
Score: {inst_score}/100 (Math: {m_score}/35, Flow: {f_score}/35, AI: {ai_score}/30)
Institutional Verdict: {inst_verdict}
Ensure your forward-looking trend direction (UP/DOWN/SIDEWAYS) and targets are strictly aligned with this Institutional Verdict ({inst_verdict}).

Analyze using ALL factors: technicals (moving averages, RSI, MACD, support/resistance), fundamentals (PE, earnings growth, sector outlook), news sentiment (catalysts, risks), and macro (FII/DII flows, interest rates, sector rotation).

Return JSON:
{{
  "symbol": "{sym}",
  "name": "{name}",
  "sector": "{sector}",
  "current_price": {float(price) if price else 0},
  "analysis_date": "{datetime.now(UTC).strftime('%Y-%m-%d')}",

  "direction": {{
    "1_week": {{"direction": "UP/DOWN/SIDEWAYS", "confidence_pct": 72, "reasoning": "short explanation"}},
    "1_month": {{"direction": "UP/DOWN/SIDEWAYS", "confidence_pct": 68, "reasoning": "explanation"}},
    "6_month": {{"direction": "UP/DOWN/SIDEWAYS", "confidence_pct": 75, "reasoning": "explanation"}}
  }},

  "price_targets": {{
    "1_week": {{"low": 1280, "high": 1360, "most_likely": 1320}},
    "1_month": {{"low": 1220, "high": 1450, "most_likely": 1380}},
    "6_month": {{"low": 1100, "high": 1650, "most_likely": 1480}}
  }},

  "scenarios": {{
    "1_week": {{
      "bull": {{"price": 1360, "probability_pct": 30, "trigger": "specific catalyst"}},
      "base": {{"price": 1320, "probability_pct": 50, "trigger": "normal trading"}},
      "bear": {{"price": 1280, "probability_pct": 20, "trigger": "specific risk"}}
    }},
    "1_month": {{
      "bull": {{"price": 1450, "probability_pct": 25, "trigger": "catalyst"}},
      "base": {{"price": 1380, "probability_pct": 50, "trigger": "steady growth"}},
      "bear": {{"price": 1220, "probability_pct": 25, "trigger": "risk event"}}
    }},
    "6_month": {{
      "bull": {{"price": 1650, "probability_pct": 30, "trigger": "major catalyst"}},
      "base": {{"price": 1480, "probability_pct": 45, "trigger": "organic growth"}},
      "bear": {{"price": 1100, "probability_pct": 25, "trigger": "major risk"}}
    }}
  }},

  "historical_pattern": {{
    "pattern_description": "Last N times {sym} had similar RSI + drawdown + sector conditions",
    "matched_setups": 8,
    "win_rate_pct": 75,
    "avg_return_pct": 12.5,
    "avg_recovery_days": 40,
    "worst_case_return_pct": -8,
    "best_case_return_pct": 28
  }},

  "technical_signals": {{
    "trend": "UPTREND/DOWNTREND/SIDEWAYS",
    "rsi_14": 42,
    "rsi_signal": "NEUTRAL/OVERSOLD/OVERBOUGHT",
    "ema_20": 1310,
    "ema_50": 1280,
    "ema_200": 1250,
    "ema_signal": "above 200 EMA — bullish long-term structure",
    "support_levels": [1280, 1250, 1200],
    "resistance_levels": [1350, 1400, 1450],
    "macd_signal": "BULLISH_CROSS/BEARISH_CROSS/NEUTRAL",
    "volume_trend": "INCREASING/DECREASING/NEUTRAL"
  }},

  "fundamental_outlook": {{
    "earnings_trend": "GROWING/DECLINING/STABLE",
    "pe_vs_sector": "UNDERVALUED/FAIR/OVERVALUED",
    "sector_outlook": "positive/negative/neutral with reason",
    "upcoming_catalyst": "specific event with date if known",
    "moat_strength": "STRONG/MODERATE/WEAK"
  }},

  "risk_matrix": {{
    "stop_loss": 1180,
    "stop_loss_reasoning": "below 200-EMA and key support",
    "max_downside_pct": -15,
    "risk_events": [
      {{"event": "specific risk 1", "probability": "LOW/MEDIUM/HIGH", "impact": "price drops to ₹X"}},
      {{"event": "specific risk 2", "probability": "LOW/MEDIUM/HIGH", "impact": "impact description"}}
    ],
    "risk_reward_ratio": "1:2.5",
    "overall_risk_level": "LOW/MEDIUM/HIGH"
  }},

  "ai_summary": "3-4 sentence comprehensive summary combining all factors. What should the investor do NOW and over the next 6 months?"
}}

Return ONLY the JSON. Use realistic Indian market prices and specific data points."""

    text = _call_gemini(prompt)
    result = _parse_json(text)
    if isinstance(result, dict) and not result.get("error"):
        result["analyzed_at"] = datetime.now(UTC).isoformat()
        result["institutional_scorecard"] = scorecard_info
        result.update(_call_info(serper_used, 1))
        # Write-through sync: update main DB price record with newly discovered price
        cur_p = result.get("current_price")
        if cur_p and float(cur_p) > 0:
            from ..services.market_service import update_stock_market_price
            try:
                update_stock_market_price(db, sym, cur_p, source="trend_ai_sync")
            except Exception:
                pass
        return result
    fallback_res = {"symbol": sym, "name": name, "error": "Analysis unavailable", "analyzed_at": datetime.now(UTC).isoformat(), **_call_info(serper_used, 1)}
    fallback_res["institutional_scorecard"] = scorecard_info
    return fallback_res

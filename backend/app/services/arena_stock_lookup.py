from datetime import UTC, datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from ..models import (
    Instrument,
    MarketPrice,
    WatchlistItem,
    Watchlist,
    Holding,
    Portfolio,
)
from .market_service import resolve_symbol, get_cached_price, get_live_or_cached_price


def get_ai_suggestions_catalog(db: Session, user_id: int = 1) -> list[dict]:
    """
    Returns live stocks discovered and telecasted across the AI Intelligence Hub:
    - Top 6 Market-Wide Setups (HAL, MCX, BEL, CAMS, DIXON, SUZLON, etc.)
    - All 6 AI Strategy categories:
        1. Fast Momentum & Delivery Breakouts (7-14 Days)
        2. Mean-Reversion Bargain Dips (14 Days to 1 Month)
        3. Untouched Multibagger Growth Rockets (3 to 6 Months)
        4. Macro Theme & Sector Tailwind Surfers (6 Months to 1 Year)
        5. Wide-Moat Monopoly Compounders (1 to 3 Years)
        6. Undervalued Value Compounders (PEG < 1.0) (1 to 2 Years)
    Provides exact symbol, name, CMP, suggested target buy, suggested target sell, stop loss, and AI catalyst rationale.
    """
    from .ai_discovery_service import get_ai_discovery_sections
    try:
        disc = get_ai_discovery_sections(db, user_id=user_id)
    except Exception as e:
        logger.error(f"Error fetching AI discovery sections: {e}")
        disc = {"top_overall_stocks": [], "sections": []}

    catalog: list[dict] = []
    seen_symbols: dict[str, dict] = {}

    # 1. Process Top Overall Market-Wide Setups first
    for st in disc.get("top_overall_stocks", []):
        sym = st["symbol"].upper()
        # Always resolve actual live/cached market price
        cmp_dec = get_live_or_cached_price(db, sym)
        cmp = float(cmp_dec) if cmp_dec and cmp_dec > 0 else float(st.get("current_price", 1000.0))
        orig_price = float(st.get("current_price") or 1.0)
        mult_sell = (float(st.get("horizon_target", 0.0)) / orig_price) if orig_price > 0 and float(st.get("horizon_target", 0.0)) > 0 else 1.20
        mult_stop = (float(st.get("stop_loss", 0.0)) / orig_price) if orig_price > 0 and float(st.get("stop_loss", 0.0)) > 0 else 0.92
        target_sell = round(cmp * (mult_sell if mult_sell > 1.0 else 1.20), 2)
        stop_loss = round(cmp * (mult_stop if 0 < mult_stop < 1.0 else 0.92), 2)
        target_buy = round(cmp * 0.96, 2)

        entry = {
            "symbol": sym,
            "name": st.get("name", sym),
            "tab": "★ Top 6 Market-Wide",
            "strategy_id": st.get("strategy_id", "top"),
            "strategy_title": st.get("strategy_title", "Top 6 Market-Wide Setups"),
            "score": int(st.get("conviction_pct", 90)),
            "verdict": st.get("action", "STRONG BUY"),
            "current_price": cmp,
            "target_buy_price": target_buy,
            "target_sell_price": target_sell,
            "stop_loss_price": stop_loss,
            "rationale": f"Score {st.get('conviction_pct', 90)}/100: {st.get('catalyst_summary', '')}",
            "is_top": True,
            "upside_pct": float(st.get("horizon_upside_pct", 0.0)),
            "horizon_label": st.get("horizon_label", ""),
        }
        seen_symbols[sym] = entry
        catalog.append(entry)

    # 2. Process all 6 AI Discovery Strategy Sections
    for sec in disc.get("sections", []):
        strat_id = sec["strategy_id"]
        strat_title = sec["title"]
        for st in sec.get("stocks", []):
            sym = st["symbol"].upper()
            cmp_dec = get_live_or_cached_price(db, sym)
            cmp = float(cmp_dec) if cmp_dec and cmp_dec > 0 else float(st.get("current_price", 1000.0))
            orig_price = float(st.get("current_price") or 1.0)
            mult_sell = (float(st.get("horizon_target", 0.0)) / orig_price) if orig_price > 0 and float(st.get("horizon_target", 0.0)) > 0 else 1.15
            mult_stop = (float(st.get("stop_loss", 0.0)) / orig_price) if orig_price > 0 and float(st.get("stop_loss", 0.0)) > 0 else 0.92
            target_sell = round(cmp * (mult_sell if mult_sell > 1.0 else 1.15), 2)
            stop_loss = round(cmp * (mult_stop if 0 < mult_stop < 1.0 else 0.92), 2)
            target_buy = round(cmp * 0.96, 2)

            if sym in seen_symbols:
                # Associate strategy_id so strategy tab filtering matches it as well
                seen_symbols[sym]["strategy_id"] = strat_id
                seen_symbols[sym]["strategy_title"] = strat_title
                continue

            entry = {
                "symbol": sym,
                "name": st.get("name", sym),
                "tab": strat_title,
                "strategy_id": strat_id,
                "strategy_title": strat_title,
                "score": int(st.get("conviction_pct", 85)),
                "verdict": st.get("action", "BUY"),
                "current_price": cmp,
                "target_buy_price": target_buy,
                "target_sell_price": target_sell,
                "stop_loss_price": stop_loss,
                "rationale": f"Score {st.get('conviction_pct', 85)}/100: {st.get('catalyst_summary', '')}",
                "is_top": False,
                "upside_pct": float(st.get("horizon_upside_pct", 0.0)),
                "horizon_label": sec.get("horizon_label", ""),
            }
            seen_symbols[sym] = entry
            catalog.append(entry)

    # Sort catalog descending by conviction score, then upside %
    catalog.sort(key=lambda x: (x["score"], x["upside_pct"]), reverse=True)
    return catalog


def get_stock_quote_with_targets(db: Session, symbol: str) -> dict:
    """Fetch live quote and algorithmic suggested buy/sell targets for any searched symbol."""
    sym = resolve_symbol(symbol.strip().upper())
    cmp_dec = get_live_or_cached_price(db, sym)
    cmp = float(cmp_dec) if cmp_dec and cmp_dec > 0 else 500.0

    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    name = inst.name if inst and inst.name else sym

    # Check if we have deep analysis
    from .ai_strategy_service import compute_2year_deep_analysis
    score = 75
    verdict = "BUY"
    target_buy = round(cmp * 0.96, 2)
    target_sell = round(cmp * 1.15, 2)
    stop_loss = round(cmp * 0.93, 2)
    rationale = f"Live market CMP: ₹{cmp:,.2f}. Algorithmic suggested buy on dip ₹{target_buy:,.2f} with target exit ₹{target_sell:,.2f}."

    try:
        deep = compute_2year_deep_analysis(sym, db)
        if deep:
            score = deep.get("composite_score", 75)
            verdict = deep.get("recommendation", "BUY")
            if deep.get("dip_support"):
                target_buy = round(float(deep["dip_support"]), 2)
            if deep.get("target_price"):
                target_sell = round(float(deep["target_price"]), 2)
            if deep.get("stop_loss"):
                stop_loss = round(float(deep["stop_loss"]), 2)
            if deep.get("dalal_verdict"):
                rationale = deep["dalal_verdict"][:200]
    except Exception:
        pass

    return {
        "symbol": sym,
        "name": name,
        "current_price": cmp,
        "target_buy_price": target_buy,
        "target_sell_price": target_sell,
        "stop_loss_price": stop_loss,
        "score": score,
        "verdict": verdict,
        "rationale": rationale,
    }


def get_user_wishlist_stocks(db: Session, user_id: int = 1) -> list[dict]:
    """Retrieve actual stocks from user's active wishlist with CMP and suggested targets."""
    from .arena_trading import resolve_stock_ai_score
    wl_items = (
        db.query(WatchlistItem)
        .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
        .filter(Watchlist.user_id == user_id)
        .all()
    )
    results = []
    seen = set()
    for item in wl_items:
        if item.symbol in seen:
            continue
        seen.add(item.symbol)
        cmp_dec = get_live_or_cached_price(db, item.symbol)
        cmp = float(cmp_dec)
        target_buy = float(item.target_buy_price) if item.target_buy_price else round(cmp * 0.96, 2)
        target_sell = float(item.target_sell_price) if item.target_sell_price else round(cmp * 1.16, 2)
        score_val = item.ai_entry_score or resolve_stock_ai_score(db, item.symbol, fallback=88)
        results.append({
            "symbol": item.symbol,
            "name": item.notes or item.symbol,
            "tab": "My Wishlist",
            "score": score_val,
            "verdict": "BUY",
            "current_price": cmp,
            "target_buy_price": target_buy,
            "target_sell_price": target_sell,
            "stop_loss_price": round(cmp * 0.93, 2),
            "rationale": f"Saved in Wishlist. Target Buy: ₹{target_buy:,.2f}",
        })
    return results


def get_user_portfolio_stocks(db: Session, user_id: int = 1) -> list[dict]:
    """Retrieve actual holdings from user's live portfolio with CMP and suggested targets."""
    from .arena_trading import resolve_stock_ai_score
    holdings = (
        db.query(Holding)
        .join(Portfolio, Portfolio.id == Holding.portfolio_id)
        .filter(Portfolio.user_id == user_id)
        .all()
    )
    results = []
    seen = set()
    for h in holdings:
        if h.symbol in seen:
            continue
        seen.add(h.symbol)
        cmp_dec = get_live_or_cached_price(db, h.symbol)
        cmp = float(cmp_dec)
        score_val = h.ai_entry_score or resolve_stock_ai_score(db, h.symbol, fallback=88)
        results.append({
            "symbol": h.symbol,
            "name": h.symbol,
            "tab": "My Portfolio",
            "score": score_val,
            "verdict": "HOLDING",
            "current_price": cmp,
            "target_buy_price": round(cmp * 0.96, 2),
            "target_sell_price": round(cmp * 1.15, 2),
            "stop_loss_price": round(cmp * 0.93, 2),
            "rationale": f"Current holding ({float(h.quantity)} shares @ ₹{float(h.buy_price):,.2f})",
        })
    return results

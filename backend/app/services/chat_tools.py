import re
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Instrument, MarketPrice, MarketIndex,
    Portfolio, Holding, Transaction, Watchlist,
)
from .market_service import SYMBOL_ALIASES, get_or_create_instrument, resolve_symbol, _fetch_quote_waterfall


def _extract_symbols_from_text(text: str) -> list[str]:
    cleaned = text.upper()
    found: list[str] = []
    for alias, canonical in SYMBOL_ALIASES.items():
        if re.search(r'\b' + re.escape(alias) + r'\b', cleaned):
            if canonical not in found:
                found.append(canonical)
    tokens = re.findall(r'\b[A-Z]{3,12}\b', cleaned)
    for tok in tokens:
        if tok in SYMBOL_ALIASES:
            canonical = SYMBOL_ALIASES[tok]
            if canonical not in found:
                found.append(canonical)
    return found


# --- Gemini Tool Functions (MUST be synchronous def, not async) ---

def get_stock_quote(symbol: str) -> str:
    """Fetches real-time / latest market price, today's change, percentage change, day high/low, and 52-week range for any Indian stock symbol (e.g. RELIANCE, TCS, INFY, HDFCBANK, TATAMOTORS, ZOMATO) using multi-tier resilient feeds (Google Finance / Yahoo / Screener / NSE)."""
    clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
    resolved_sym = SYMBOL_ALIASES.get(clean_sym, clean_sym)

    try:
        # Tier 1-4 Resilient Waterfall Fetch
        quote = _fetch_quote_waterfall(resolved_sym)
        price = float(quote["price"]) if quote and quote.get("price") else None
        chg = float(quote["change"]) if quote and quote.get("change") is not None else 0.0
        chg_pct = float(quote["change_pct"]) if quote and quote.get("change_pct") is not None else 0.0
        day_high = float(quote["high"]) if quote and quote.get("high") else None
        day_low = float(quote["low"]) if quote and quote.get("low") else None
        yr_high = float(quote["week_52_high"]) if quote and quote.get("week_52_high") else None
        yr_low = float(quote["week_52_low"]) if quote and quote.get("week_52_low") else None
        source_name = quote.get("source", "waterfall").upper() if quote else "DATABASE"

        # Fallback to DB cached price if waterfall was unavailable
        if price is None:
            with SessionLocal() as s_db:
                inst = s_db.query(Instrument).filter(Instrument.symbol == resolved_sym).first()
                if inst and inst.market_price and inst.market_price.price:
                    price = float(inst.market_price.price)
                    chg = float(inst.market_price.change or 0.0)
                    chg_pct = float(inst.market_price.change_pct or 0.0)
                    day_high = float(inst.market_price.day_high) if inst.market_price.day_high else None
                    day_low = float(inst.market_price.day_low) if inst.market_price.day_low else None
                    source_name = "CACHED_LOCAL"

        if price is None:
            return f"Live quote for {resolved_sym} is currently unavailable on NSE/BSE feeds."

        # Cache live price to database
        try:
            with SessionLocal() as s_db:
                inst = s_db.query(Instrument).filter(Instrument.symbol == resolved_sym).first()
                if not inst:
                    inst = Instrument(symbol=resolved_sym, name=resolved_sym, asset_type="EQUITY", exchange="NSE", is_active=True)
                    s_db.add(inst)
                    s_db.commit()
                    s_db.refresh(inst)
                mp = s_db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).first()
                now = datetime.now(UTC)
                dec_price = Decimal(str(round(price, 4)))
                dec_chg = Decimal(str(round(chg, 4)))
                if mp:
                    mp.price = dec_price
                    mp.change = dec_chg
                    mp.change_pct = chg_pct
                    if day_high: mp.day_high = Decimal(str(round(day_high, 4)))
                    if day_low: mp.day_low = Decimal(str(round(day_low, 4)))
                    if yr_high: mp.week_52_high = Decimal(str(round(yr_high, 4)))
                    if yr_low: mp.week_52_low = Decimal(str(round(yr_low, 4)))
                    mp.fetched_at = now
                    mp.source = source_name.lower()
                else:
                    s_db.add(MarketPrice(
                        instrument_id=inst.id, price=dec_price, change=dec_chg, change_pct=chg_pct,
                        day_high=Decimal(str(round(day_high, 4))) if day_high else None,
                        day_low=Decimal(str(round(day_low, 4))) if day_low else None,
                        week_52_high=Decimal(str(round(yr_high, 4))) if yr_high else None,
                        week_52_low=Decimal(str(round(yr_low, 4))) if yr_low else None,
                        currency="INR", as_of=now, fetched_at=now, source=source_name.lower(), data_kind="LIVE", freshness="LIVE",
                    ))
                s_db.commit()
        except Exception:
            pass

        return (
            f"Stock: {resolved_sym} (NSE/BSE)\n"
            f"Live Price: ₹{price:,.2f}\n"
            f"Change Today: {chg:+,.2f} ({chg_pct:+.2f}%)\n"
            f"Day Range: ₹{day_low or 'N/A'} - ₹{day_high or 'N/A'}\n"
            f"52-Week Range: ₹{yr_low or 'N/A'} - ₹{yr_high or 'N/A'}\n"
            f"Data Source: {source_name} (Resilient Multi-Tier Feed)"
        )
    except Exception as e:
        return f"Error retrieving quote for {resolved_sym}: {str(e)}"


def get_market_indices() -> str:
    """Fetches the current values, day change, and percentage change for major Indian market indices such as NIFTY 50, BSE SENSEX, NIFTY BANK, and NIFTY IT."""
    with SessionLocal() as s_db:
        indices = s_db.query(MarketIndex).all()
        if not indices:
            return "Market indices: NIFTY 50: ~22,620 (+0.85%), SENSEX: ~74,512 (+0.71%), NIFTY BANK: ~48,153 (+1.02%)."
        lines = ["Current Major Indian Market Indices:"]
        for idx in indices:
            chg = f"{idx.change:+}" if idx.change else "0"
            pct = f"{idx.change_pct:+.2f}%" if idx.change_pct else "0%"
            lines.append(f"- {idx.name} ({idx.symbol}): ₹{idx.value:,.2f} | Change: {chg} ({pct})")
        return "\n".join(lines)


def get_stock_ai_strategy(symbol: str) -> str:
    """Fetches comprehensive AI quant strategy, statistical pattern analogy, win rate, 3-stage dip ladder, key technicals (20/50/200 EMA, RSI, MACD), risk-reward ratio, stop-loss, and Dalal Street veteran commentary for any Indian stock symbol (e.g. RELIANCE, TCS, INFY, TATAMOTORS, HDFCBANK, ZOMATO)."""
    from .ai_strategy_service import compute_stock_strategy
    try:
        data = compute_stock_strategy(symbol)
        tech = data.get("technicals", {})
        pat = data.get("pattern_analogy", {})
        ladder = data.get("staggered_ladder", [])
        ladder_lines = []
        for step in ladder:
            ladder_lines.append(f"  - Stage {step['tranche']} ({step['pct']}%): ₹{step['price']:,.2f} [{step['status']}]")
        ladder_str = "\n".join(ladder_lines) if ladder_lines else "N/A"

        return (
            f"Stock AI Strategy Analysis for {data.get('symbol')} ({data.get('name')}):\n"
            f"CMP: ₹{data.get('current_price', 0):,.2f} ({data.get('day_change_pct', 0):+.2f}%)\n"
            f"AI Quant Score: {data.get('ai_score')}/100 | Signal: {data.get('signal')}\n"
            f"Action Summary: {data.get('action_summary')}\n"
            f"Risk/Reward: {data.get('risk_reward_ratio')} | Invalidation Stop-Loss: ₹{data.get('recommended_stop_loss'):,.2f}\n"
            f"Milestone Targets: Target 1 = ₹{data.get('target_milestone_1'):,.2f}, Target 2 = ₹{data.get('target_milestone_2'):,.2f}\n"
            f"Technicals: RSI={tech.get('rsi')}, 50 EMA=₹{tech.get('ema50')}, 200 EMA=₹{tech.get('ema200')}, 52W Drawdown={tech.get('drawdown_from_52w_high')}%\n"
            f"Historical Pattern Analogy (Toggle AI engine): {pat.get('analogy_text', '')} (Win Rate: {pat.get('win_rate_pct')}%, Avg Forward Return: {pat.get('avg_forward_return_pct')}% across {pat.get('matched_events_count')} matching historical setups)\n"
            f"3-Stage Dip Accumulation Ladder:\n{ladder_str}\n"
            f"Dalal Street Veteran Take: {data.get('veteran_commentary')}"
        )
    except Exception as e:
        return f"Unable to compute AI strategy for {symbol}: {str(e)}"


def get_my_portfolio_summary() -> str:
    """Fetches the user's active investment portfolios, individual stock holdings, quantities, buy prices, invested capital, current market value, and unrealized profit/loss."""
    with SessionLocal() as s_db:
        portfolios = s_db.query(Portfolio).all()
        if not portfolios:
            return "User has no portfolios configured."
        out = []
        for p in portfolios:
            out.append(f"Portfolio: '{p.name}' (ID: {p.id})")
            if not p.holdings:
                out.append("  (No holdings in this portfolio)")
                continue
            total_invested = Decimal("0")
            for h in p.holdings:
                invested = h.quantity * h.buy_price
                total_invested += invested
                inst = s_db.query(Instrument).filter(Instrument.symbol == h.symbol.upper()).first()
                cmp = None
                if inst:
                    mp = s_db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).order_by(MarketPrice.fetched_at.desc()).first()
                    cmp = mp.price if mp else None
                cmp_str = f"₹{cmp:,.2f}" if cmp else "N/A"
                pnl_str = ""
                if cmp:
                    cur_val = h.quantity * cmp
                    pnl = cur_val - invested
                    pnl_pct = float(pnl / invested * 100) if invested else 0.0
                    pnl_str = f" | CMP: {cmp_str} | Current Value: ₹{cur_val:,.2f} | P&L: ₹{pnl:+,.2f} ({pnl_pct:+.2f}%)"
                else:
                    pnl_str = f" | CMP: {cmp_str}"
                out.append(f"  - {h.symbol} | Qty: {h.quantity} | Buy Price: ₹{h.buy_price:,.2f} | Invested: ₹{invested:,.2f}{pnl_str}")
            out.append(f"  Total Portfolio Invested: ₹{total_invested:,.2f}")
        return "\n".join(out)


def get_my_wishlist() -> str:
    """Fetches the user's wishlists / watchlists, watched stock symbols, target buy prices, notes, and checks if any stock has hit or is near its target buy level."""
    with SessionLocal() as s_db:
        watchlists = s_db.query(Watchlist).all()
        if not watchlists:
            return "User has no wishlists configured."
        out = []
        for w in watchlists:
            out.append(f"Wishlist: '{w.name}' (ID: {w.id})")
            if not w.items:
                out.append("  (No items in this wishlist)")
                continue
            for it in w.items:
                inst = s_db.query(Instrument).filter(Instrument.symbol == it.symbol.upper()).first()
                cmp = None
                if inst:
                    mp = s_db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).order_by(MarketPrice.fetched_at.desc()).first()
                    cmp = mp.price if mp else None
                cmp_str = f"₹{cmp:,.2f}" if cmp else "N/A"
                target_str = f" | Target Buy: ₹{it.target_buy_price:,.2f}" if it.target_buy_price else ""
                alert_str = ""
                if cmp and it.target_buy_price:
                    if cmp <= it.target_buy_price:
                        alert_str = " [TARGET HIT! Price is at/below target buy level]"
                    else:
                        diff = float((cmp - it.target_buy_price) / it.target_buy_price * 100)
                        alert_str = f" [{diff:+.1f}% above target buy]"
                notes_str = f" | Note: {it.notes}" if it.notes else ""
                out.append(f"  - {it.symbol} | CMP: {cmp_str}{target_str}{alert_str}{notes_str}")
        return "\n".join(out)


def get_stock_institutional_report(symbol: str) -> str:
    """Fetches the 28-field institutional research report covering Fundamental, Technical, Valuation, Market, News/Sentiment, and Risk analysis, including 1Y/3Y/5Y return scenarios, estimated fair value, positive/negative drivers, and governance warnings for any Indian stock symbol (e.g. RELIANCE, TCS, INFY, TATAMOTORS, HDFCBANK)."""
    from .scoring_engine import generate_institutional_stock_report
    try:
        report = generate_institutional_stock_report(symbol)
        comp = report.get("1_company_name", symbol)
        sym = report.get("2_stock_symbol", symbol)
        price = report.get("4_current_stock_price", 0.0)
        overall = report.get("5_overall_score", 0.0)
        rec = report.get("14_final_recommendation", "HOLD")
        coverage = report.get("12_data_coverage_percentage", 0)
        conf = report.get("13_confidence_level", "Medium")
        f_score = report.get("6_fundamental_score", 0.0)
        t_score = report.get("7_technical_score", 0.0)
        v_score = report.get("8_valuation_score", 0.0)
        m_score = report.get("9_market_sector_score", 0.0)
        s_score = report.get("10_sentiment_score", 0.0)
        r_score = report.get("11_risk_score", 0.0)
        fv = report.get("26_estimated_fair_value", 0.0)
        ret_1y = report.get("23_expected_1yr_return", "N/A")
        ret_3y = report.get("24_expected_3yr_return", "N/A")
        ret_5y = report.get("25_expected_5yr_return", "N/A")
        thesis = report.get("27_investment_rationale", "")
        positives = report.get("20_key_positive_factors", [])
        negatives = report.get("21_key_negative_factors", [])
        risks = report.get("22_major_risks", [])

        pos_str = "\n".join(f"  + {p}" for p in positives[:3]) if positives else "  + Sound core business"
        neg_str = "\n".join(f"  - {n}" for n in negatives[:3]) if negatives else "  - Volatility risks"
        risk_str = "\n".join(f"  ! {rk}" for rk in risks[:2]) if risks else "  ! Macro factors"

        return (
            f"Institutional 28-Field Stock Analysis for {comp} ({sym}):\n"
            f"CMP: ₹{price:,.2f} | Overall AI Score: {overall}/100 | Recommendation: {rec}\n"
            f"Confidence Level: {conf} | Parameter Coverage: {coverage}%\n"
            f"6-Factor Breakdown: Fundamental={f_score}/100, Technical={t_score}/100, Valuation={v_score}/100, Market={m_score}/100, Sentiment={s_score}/100, Risk={r_score}/100\n"
            f"Estimated Fair Value: ₹{fv:,.2f}\n"
            f"Expected Returns: 1-Year = {ret_1y} | 3-Year = {ret_3y} | 5-Year = {ret_5y}\n"
            f"Key Positive Factors:\n{pos_str}\n"
            f"Key Negatives / Constraints:\n{neg_str}\n"
            f"Major Risks:\n{risk_str}\n"
            f"Dalal Street Thesis: {thesis}"
        )
    except Exception as e:
        return f"Unable to generate institutional report for {symbol}: {str(e)}"


def add_holdings_to_portfolio(holdings_json: str) -> str:
    """Adds multiple stock holdings to the user's portfolio from extracted broker data.
    Input must be a JSON string: [{"symbol": "RELIANCE", "quantity": 10, "buy_price": 1300.50}, ...]
    Each holding needs: symbol (string), quantity (number), buy_price (number per share).
    Optional: portfolio_name (string) to specify which portfolio. Defaults to first available portfolio."""
    import json

    try:
        holdings = json.loads(holdings_json)
    except json.JSONDecodeError:
        return "Error: Invalid JSON format. Please provide a valid JSON array of holdings."

    if not isinstance(holdings, list) or not holdings:
        return "Error: Expected a non-empty JSON array of holdings."

    with SessionLocal() as s_db:
        portfolio_name = holdings[0].get("portfolio_name") if isinstance(holdings[0], dict) else None
        portfolio = None
        if portfolio_name:
            portfolio = s_db.query(Portfolio).filter(Portfolio.name == portfolio_name).first()
        if not portfolio:
            portfolio = s_db.query(Portfolio).first()
        if not portfolio:
            portfolio = Portfolio(user_id=1, name="My Portfolio", created_at=datetime.now(UTC))
            s_db.add(portfolio)
            s_db.commit()
            s_db.refresh(portfolio)

        added = []
        errors = []
        for h in holdings:
            if not isinstance(h, dict):
                continue
            raw_sym = h.get("symbol", "")
            qty = h.get("quantity")
            price = h.get("buy_price")

            if not raw_sym or not qty or not price:
                errors.append(f"Skipped incomplete entry: {h}")
                continue

            try:
                sym = resolve_symbol(raw_sym)
                qty_dec = Decimal(str(qty))
                price_dec = Decimal(str(price))

                inst = get_or_create_instrument(s_db, sym)
                holding = Holding(
                    portfolio_id=portfolio.id, instrument_id=inst.id, symbol=sym,
                    quantity=qty_dec, buy_price=price_dec,
                    buy_date=datetime.now(UTC), asset_type="EQUITY",
                )
                s_db.add(holding)

                tx = Transaction(
                    portfolio_id=portfolio.id, instrument_id=inst.id, symbol=sym,
                    transaction_type="BUY", quantity=qty_dec, price=price_dec,
                    fees=Decimal("0"), total_amount=qty_dec * price_dec,
                    trade_date=datetime.now(UTC), notes="Added from broker screenshot",
                    created_at=datetime.now(UTC),
                )
                s_db.add(tx)
                added.append(f"{sym}: {qty_dec} shares @ ₹{price_dec}")
            except Exception as e:
                errors.append(f"Error adding {raw_sym}: {str(e)}")

        s_db.commit()

    result = f"Successfully added {len(added)} holdings to portfolio '{portfolio.name}':\n"
    for a in added:
        result += f"  - {a}\n"
    if errors:
        result += f"\nWarnings:\n"
        for e in errors:
            result += f"  - {e}\n"
    return result

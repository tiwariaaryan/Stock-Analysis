import asyncio
import os
import re
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Instrument, MarketPrice, MarketIndex,
    Portfolio, Holding, Transaction, Watchlist, ChatSession, ChatMessage,
)
from ..ai.gemini import get_chat_client, get_chat_model_name, get_gemini_client, get_model_name
from .market_service import SYMBOL_ALIASES, get_or_create_instrument, resolve_symbol


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
    """Fetches real-time / latest market price, today's change, percentage change, day high/low, and 52-week range for any Indian stock symbol (e.g. RELIANCE, TCS, INFY, HDFCBANK, TATAMOTORS, ZOMATO)."""
    import yfinance as yf

    clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
    resolved_sym = SYMBOL_ALIASES.get(clean_sym, clean_sym)

    old_http = os.environ.pop("http_proxy", None)
    old_https = os.environ.pop("https_proxy", None)
    try:
        ticker = yf.Ticker(f"{resolved_sym}.NS")
        fast = ticker.fast_info
        price = fast.last_price
        prev = fast.previous_close

        if price is None:
            hist = ticker.history(period="5d", interval="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else price
            else:
                return f"Live quote for {resolved_sym} is currently unavailable on NSE/BSE."

        chg = round(price - (prev or price), 2)
        chg_pct = round((chg / prev) * 100, 2) if prev else 0.0
        day_high = round(fast.day_high, 2) if fast.day_high else None
        day_low = round(fast.day_low, 2) if fast.day_low else None
        yr_high = round(fast.year_high, 2) if fast.year_high else None
        yr_low = round(fast.year_low, 2) if fast.year_low else None

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
                dec_price = Decimal(str(round(price, 2)))
                dec_chg = Decimal(str(chg))
                if mp:
                    mp.price = dec_price
                    mp.change = dec_chg
                    mp.change_pct = chg_pct
                    mp.fetched_at = now
                else:
                    s_db.add(MarketPrice(
                        instrument_id=inst.id, price=dec_price, change=dec_chg, change_pct=chg_pct,
                        currency="INR", as_of=now, fetched_at=now, source="yfinance", data_kind="LIVE", freshness="LIVE",
                    ))
                s_db.commit()
        except Exception:
            pass

        return (
            f"Stock: {resolved_sym} (NSE)\n"
            f"Live Price: ₹{price:,.2f}\n"
            f"Change Today: {chg:+,.2f} ({chg_pct:+.2f}%)\n"
            f"Day Range: ₹{day_low or 'N/A'} - ₹{day_high or 'N/A'}\n"
            f"52-Week Range: ₹{yr_low or 'N/A'} - ₹{yr_high or 'N/A'}\n"
            f"Data Source: NSE Live/EOD Market Data"
        )
    except Exception as e:
        return f"Error retrieving quote for {resolved_sym}: {str(e)}"
    finally:
        if old_http:
            os.environ["http_proxy"] = old_http
        if old_https:
            os.environ["https_proxy"] = old_https


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


# --- Build Central Context from DB Cache (no live API calls) ---

def build_central_context(db: Session, user_id: int = 1) -> str:
    from .market_service import get_last_refresh_time, get_cached_price

    sections = []
    refresh_time = get_last_refresh_time()
    age_str = ""
    if refresh_time:
        age_secs = (datetime.now(UTC) - refresh_time).total_seconds()
        if age_secs < 60:
            age_str = f"(prices updated {int(age_secs)}s ago)"
        elif age_secs < 3600:
            age_str = f"(prices updated {int(age_secs/60)}m ago)"
        else:
            age_str = f"(prices updated {int(age_secs/3600)}h ago — may be stale)"
    else:
        age_str = "(prices not yet refreshed — user should click Refresh Prices)"

    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    if portfolios:
        lines = [f"=== USER'S PORTFOLIOS === {age_str}"]
        for p in portfolios:
            lines.append(f"\nPortfolio: {p.name} (ID: {p.id})")
            if not p.holdings:
                lines.append("  (No holdings)")
                continue
            total_invested = Decimal("0")
            total_current = Decimal("0")
            has_current = False
            for h in p.holdings:
                invested = h.quantity * h.buy_price
                total_invested += invested
                cmp = get_cached_price(db, h.symbol)
                cmp_str = "N/A"
                pnl_str = ""
                if cmp:
                    cur_val = h.quantity * cmp
                    pnl = cur_val - invested
                    pnl_pct = float(pnl / invested * 100) if invested else 0
                    total_current += cur_val
                    has_current = True
                    cmp_str = f"₹{cmp}"
                    pnl_str = f" | P&L: ₹{pnl:.2f} ({pnl_pct:+.2f}%)"
                lines.append(f"  - {h.symbol} | Qty: {h.quantity} | Buy: ₹{h.buy_price} | CMP: {cmp_str} | Invested: ₹{invested:.2f}{pnl_str}")
            lines.append(f"  Total Invested: ₹{total_invested:.2f}")
            if has_current:
                total_pnl = total_current - total_invested
                lines.append(f"  Current Value: ₹{total_current:.2f} | Total P&L: ₹{total_pnl:.2f} ({float(total_pnl/total_invested*100):+.2f}%)")
        sections.append("\n".join(lines))
    else:
        sections.append("=== USER'S PORTFOLIOS ===\nUser has no active portfolios.")

    watchlists = db.query(Watchlist).filter(Watchlist.user_id == user_id).all()
    if watchlists:
        w_lines = ["\n=== USER'S WISHLISTS / WATCHLISTS ==="]
        for w in watchlists:
            w_lines.append(f"\nWishlist: {w.name} (ID: {w.id})")
            if not w.items:
                w_lines.append("  (No items)")
                continue
            for it in w.items:
                cmp = get_cached_price(db, it.symbol)
                cmp_str = f"₹{cmp}" if cmp else "N/A"
                target_str = f" | Target Buy: ₹{it.target_buy_price}" if it.target_buy_price else ""
                alert_str = ""
                if cmp and it.target_buy_price:
                    if cmp <= it.target_buy_price:
                        alert_str = " [TARGET HIT!]"
                    else:
                        diff = float((cmp - it.target_buy_price) / it.target_buy_price * 100)
                        alert_str = f" [{diff:+.1f}% above target]"
                notes_str = f" | Note: {it.notes}" if it.notes else ""
                w_lines.append(f"  - {it.symbol} | CMP: {cmp_str}{target_str}{alert_str}{notes_str}")
        sections.append("\n".join(w_lines))
    return "\n\n".join(sections)


# --- Main Chat Handler ---

async def handle_chat_message(db: Session, message: str, session_id: int | None = None, user_id: int = 1) -> dict:
    client = get_chat_client()
    if not client:
        return {"reply": "Gemini API key not configured. Add GEMINI_API_KEY1 to .env and restart.", "session_id": None}

    session = None
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        session = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).first()
        if not session:
            session = ChatSession(user_id=user_id, title=message[:50].strip(), created_at=datetime.now(UTC), updated_at=datetime.now(UTC))
            db.add(session)
            db.commit()
            db.refresh(session)

    user_msg = ChatMessage(session_id=session.id, role="user", content=message, created_at=datetime.now(UTC))
    db.add(user_msg)
    session.updated_at = datetime.now(UTC)
    db.commit()

    mentioned_symbols = _extract_symbols_from_text(message)
    live_quotes_section = ""
    if mentioned_symbols:
        lines = ["\n=== LIVE MARKET QUOTES FOR REQUESTED STOCKS ==="]
        for sym in mentioned_symbols:
            lines.append(f"{get_stock_quote(sym)}\n")
        live_quotes_section = "\n".join(lines)

    central_context = build_central_context(db, user_id=user_id)

    system_prompt = f"""You are an elite Dalal Street Veteran quantitative investment research copilot for InvestIntel, an Indian stock market intelligence platform.
You combine deep Indian market context with quantitative rigour, sharp risk-to-reward ratios (R:R), and a pragmatic, capital-preservation-first philosophy.

PERSONA & TONE:
- Pragmatic Dalal Street Veteran: candid, disciplined, realistic, and risk-conscious.
- Never promote blind greed or hype up penny stocks. Emphasize risk management, trailing stop-losses, and staggered accumulation.
- When asked for stock recommendations or whether to buy/sell: outline concrete statistical factors (RSI, 50/200 EMA trend, 52-week drawdown, volume), state an invalidation stop-loss, and suggest a 3-stage staggered entry ladder (30% / 40% / 30%).

CURRENT ACCOUNT DATA:
{central_context}
{live_quotes_section}

DOMAIN ROUTING RULES:
1. STOCK PREDICTION, STRATEGY, TREND & QUANT QUERIES (e.g. "what is the strategy for Tata Motors?", "should I buy Reliance now?", "prediction for TCS"):
   - ALWAYS call `get_stock_ai_strategy(symbol)` to fetch the quantitative AI score, signal badge, Toggle-AI style statistical pattern win rate analogy, staggered dip ladder, and stop-loss!
   - Highlight the Dalal Street Veteran take and provide disciplined entry/exit milestones.
2. LIVE MARKET & STOCK PRICE QUERIES (e.g. "tell me the reliance price", "what is Tata Motors trading at?"):
   - Answer primarily using the LIVE MARKET QUOTES above or call `get_stock_quote(symbol)`.
   - Report the live Current Market Price (CMP), today's change amount, percentage change, and day range.
   - NEVER report CMP as "N/A" or tell the user to click Refresh Prices when asked about live prices!
3. PORTFOLIO QUERIES (e.g. "what are the stocks in my portfolio?", "how is my portfolio doing?"):
   - Answer using the user's Portfolio Holdings and calculations, flagging positions that have hit profit milestones (+25%) or stop-loss defense zones.
4. WISHLIST / WATCHLIST QUERIES (e.g. "list down stocks in my wishlist", "any buy targets hit?"):
   - Answer using the Wishlists data, mentioning target buy prices and whether 3-stage ladder tranche 1 is triggered.
5. INSTITUTIONAL DEEP DIVE & 6-MODULE / 28-FIELD RESEARCH (e.g. "give me institutional analysis for Tata Motors", "fundamental score of Reliance", "what is the fair value of Infy?"):
   - Call `get_stock_institutional_report(symbol)` to fetch the institutional grade report with Fundamental, Technical, Valuation, Market, Sentiment, and Risk module scores, estimated fair value, 1-5 year return scenarios, and governance alerts!
6. MARKET INDICES & MACRO REGIME (e.g. "how is the market today?", "nifty price"):
   - Answer using `get_market_indices()`, assessing whether the broader market is in Bullish Expansion, Distribution, or Sideways consolidation.
7. HYBRID COMPARISONS (e.g. "is Reliance trading below my buy price?"):
   - Compare the live market price against the user's portfolio buy price!

FORMATTING RULES:
- Format currency with ₹ (Indian Rupees).
- Highlight stock tickers in backticks (e.g. `RELIANCE`).
- Keep responses clean, concise, and structured with markdown bullet points and bold highlights.
- Disclaimer: You are an AI research assistant, not a SEBI-registered financial advisor."""

    past_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(12)
        .all()
    )
    past_messages.reverse()

    messages = []
    last_role = None
    for m in past_messages:
        if not m.content or "All models are currently unavailable" in m.content:
            continue
        role = "model" if m.role in ("assistant", "model") else "user"
        if role == last_role:
            if messages:
                messages[-1]["parts"][0]["text"] += "\n" + m.content
            continue
        messages.append({"role": role, "parts": [{"text": m.content}]})
        last_role = role

    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    if not messages or messages[-1]["role"] != "user":
        messages.append({"role": "user", "parts": [{"text": message}]})

    models_to_try = [get_chat_model_name(), "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", get_model_name()]
    unique_models = list(dict.fromkeys(m for m in models_to_try if m))

    chat_tools = [get_stock_quote, get_market_indices, get_my_portfolio_summary, get_my_wishlist, get_stock_ai_strategy, get_stock_institutional_report]

    saved_proxy = {}
    for key in list(os.environ):
        if "proxy" in key.lower():
            saved_proxy[key] = os.environ.pop(key)

    reply_text = None
    last_err = ""
    try:
        active_client = client or get_gemini_client()
        if not active_client:
            return {"reply": "Gemini API key not configured.", "session_id": session.id}

        for model in unique_models:
            for retry in range(2):
                try:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            active_client.models.generate_content,
                            model=model,
                            contents=messages,
                            config={"system_instruction": system_prompt, "tools": chat_tools},
                        ),
                        timeout=22,
                    )
                    reply_text = response.text or "I couldn't generate a response. Please try again."
                    break
                except asyncio.TimeoutError:
                    last_err = f"Model {model} timed out."
                    break
                except Exception as e:
                    err_str = str(e)
                    last_err = err_str
                    if "tool" in err_str.lower() or "function" in err_str.lower():
                        try:
                            fb = await asyncio.wait_for(
                                asyncio.to_thread(
                                    active_client.models.generate_content,
                                    model=model, contents=messages,
                                    config={"system_instruction": system_prompt},
                                ),
                                timeout=18,
                            )
                            reply_text = fb.text
                            if reply_text:
                                break
                        except Exception:
                            pass
                    if ("503" in err_str or "UNAVAILABLE" in err_str) and retry < 1:
                        await asyncio.sleep(1.5)
                        continue
                    break
            if reply_text:
                break
    finally:
        os.environ.update(saved_proxy)

    if reply_text:
        bot_msg = ChatMessage(session_id=session.id, role="model", content=reply_text, created_at=datetime.now(UTC))
        db.add(bot_msg)
        db.commit()
    else:
        reply_text = f"All models are currently unavailable. Last error: {last_err}\n\nPlease try again in a minute."

    return {"reply": reply_text, "session_id": session.id}


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


async def handle_files_chat(
    db: Session, message: str, files: list[dict],
    session_id: int | None = None, user_id: int = 1,
) -> dict:
    """Handle chat with multiple attached files — images, PDFs, text/markdown."""
    import base64

    client = get_chat_client()
    if not client:
        return {"reply": "Gemini API key not configured.", "session_id": None}

    session = None
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        session = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).first()
        if not session:
            session = ChatSession(user_id=user_id, title="File analysis", created_at=datetime.now(UTC), updated_at=datetime.now(UTC))
            db.add(session)
            db.commit()
            db.refresh(session)

    filenames = [f["filename"] for f in files]
    user_msg = ChatMessage(
        session_id=session.id, role="user",
        content=f"[{len(files)} file(s): {', '.join(filenames)}] {message}",
        created_at=datetime.now(UTC),
    )
    db.add(user_msg)
    session.updated_at = datetime.now(UTC)
    db.commit()

    central_context = build_central_context(db, user_id=user_id)

    system_prompt = f"""You are an AI investment research assistant for InvestIntel.
You can analyze broker screenshots, PDFs, and documents to extract stock holdings.

CURRENT PORTFOLIO DATA:
{central_context}

WHEN THE USER SENDS BROKER FILES:
1. Carefully read ALL attached files — images show holdings tables, PDFs contain statements, text files have data.
2. Extract stock names, quantities, buy/average prices, and current values.
3. Map company names to NSE ticker symbols (e.g. "Reliance Industries Ltd" → "RELIANCE", "Infosys Ltd" → "INFY", "HDFC Bank Ltd" → "HDFCBANK").
4. Present extracted data in a clean markdown table.
5. If the user asks to add to portfolio, call `add_holdings_to_portfolio` with JSON: [{{"symbol": "RELIANCE", "quantity": 10, "buy_price": 1300.50}}, ...]
6. If multiple files, combine data from ALL files.

IMPORTANT:
- Extract exact numbers — quantity, average buy price.
- Use Indian NSE ticker symbols.
- Currency is ₹ (Indian Rupees).
- Confirm what you extracted before adding."""

    parts = [{"text": message or "Please analyze these files and extract the stock holdings."}]

    for f in files:
        mime = f["mime"]
        raw = f["bytes"]
        fname = f["filename"].lower()

        if mime.startswith("image/") or fname.endswith((".png", ".jpg", ".jpeg", ".webp")):
            b64 = base64.b64encode(raw).decode("utf-8")
            parts.append({"inline_data": {"mime_type": mime, "data": b64}})

        elif mime == "application/pdf" or fname.endswith(".pdf"):
            b64 = base64.b64encode(raw).decode("utf-8")
            parts.append({"inline_data": {"mime_type": "application/pdf", "data": b64}})

        elif mime.startswith("text/") or fname.endswith((".md", ".txt", ".csv", ".json")):
            try:
                text_content = raw.decode("utf-8")
            except UnicodeDecodeError:
                text_content = raw.decode("latin-1")
            parts.append({"text": f"\n--- Content of {f['filename']} ---\n{text_content}\n--- End of file ---"})

        else:
            try:
                text_content = raw.decode("utf-8")
                parts.append({"text": f"\n--- Content of {f['filename']} ---\n{text_content}\n--- End of file ---"})
            except Exception:
                b64 = base64.b64encode(raw).decode("utf-8")
                parts.append({"inline_data": {"mime_type": mime, "data": b64}})

    contents = [{"role": "user", "parts": parts}]
    tools = [add_holdings_to_portfolio, get_stock_quote, get_my_portfolio_summary]

    saved_proxy = {}
    for key in list(os.environ):
        if "proxy" in key.lower():
            saved_proxy[key] = os.environ.pop(key)

    reply_text = None
    last_err = ""
    try:
        active_client = client or get_gemini_client()
        if not active_client:
            return {"reply": "Gemini API key not configured.", "session_id": session.id}

        models_to_try = [get_chat_model_name(), get_model_name()]
        unique_models = list(dict.fromkeys(m for m in models_to_try if m))

        for model in unique_models:
            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        active_client.models.generate_content,
                        model=model,
                        contents=contents,
                        config={"system_instruction": system_prompt, "tools": tools},
                    ),
                    timeout=45,
                )
                reply_text = response.text or "I couldn't process the files. Please try again."
                break
            except asyncio.TimeoutError:
                last_err = f"Model {model} timed out analyzing {len(files)} file(s)."
            except Exception as e:
                err_str = str(e)
                last_err = err_str
                if "503" in err_str or "UNAVAILABLE" in err_str:
                    continue
                break
    finally:
        os.environ.update(saved_proxy)

    if reply_text:
        bot_msg = ChatMessage(session_id=session.id, role="model", content=reply_text, created_at=datetime.now(UTC))
        db.add(bot_msg)
        db.commit()
    else:
        reply_text = f"Could not analyze the files. Last error: {last_err}"

    return {"reply": reply_text, "session_id": session.id}

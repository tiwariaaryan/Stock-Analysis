import asyncio
import os
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Portfolio, Watchlist, ChatSession, ChatMessage,
)
from ..ai.gemini import get_chat_client, get_chat_model_name, get_gemini_client, get_model_name
from .chat_tools import (  # noqa: F401
    _extract_symbols_from_text, get_stock_quote, get_market_indices,
    get_stock_ai_strategy, get_my_portfolio_summary, get_my_wishlist,
    get_stock_institutional_report, add_holdings_to_portfolio,
)


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

    models_to_try = [
        get_chat_model_name(),
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
        get_model_name(),
    ]
    unique_models = [m for m in dict.fromkeys(models_to_try) if m]

    chat_tools = [get_stock_quote, get_market_indices, get_my_portfolio_summary, get_my_wishlist, get_stock_ai_strategy, get_stock_institutional_report]

    saved_proxy = {}
    for key in list(os.environ):
        if "proxy" in key.lower():
            saved_proxy[key] = os.environ.pop(key)

    reply_text = None
    last_err = ""
    try:
        active_client = client or get_chat_client() or get_gemini_client()
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
        active_client = client or get_chat_client() or get_gemini_client()
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

"""Email notification service — Gmail SMTP with HTML templates.
Sends: Morning Brief, Wishlist Signals, Smart Alerts, Weekly Report."""
import smtplib
from datetime import UTC, datetime
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Portfolio, Watchlist, Instrument, MarketPrice
from ..services.market_service import resolve_symbol, get_cached_price, POPULAR_STOCKS

_EMAIL_STYLE = """
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d14; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 12px; padding: 24px; margin-bottom: 20px; text-align: center; }
  .header h1 { color: #a78bfa; font-size: 20px; margin: 0 0 4px 0; }
  .header p { color: #64748b; font-size: 12px; margin: 0; }
  .card { background: #151520; border: 1px solid #1f1f32; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .card h3 { color: #e2e8f0; font-size: 14px; margin: 0 0 10px 0; }
  .gain { color: #00c853; } .loss { color: #ff5252; } .warn { color: #f59e0b; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .badge-green { background: rgba(0,200,83,0.15); color: #00c853; border: 1px solid rgba(0,200,83,0.3); }
  .badge-red { background: rgba(255,82,82,0.15); color: #ff5252; border: 1px solid rgba(255,82,82,0.3); }
  .badge-yellow { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
  .badge-purple { background: rgba(124,58,237,0.15); color: #a78bfa; border: 1px solid rgba(124,58,237,0.3); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #1f1f32; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #1f1f32; color: #e2e8f0; }
  .footer { text-align: center; color: #334155; font-size: 10px; margin-top: 20px; padding: 12px; }
  .mono { font-family: 'SF Mono', Monaco, monospace; }
</style>
"""


def _send_email(subject: str, html_body: str) -> dict:
    """Send HTML email via Gmail SMTP."""
    settings = get_settings()
    if not settings.gmail_address or not settings.gmail_app_password:
        return {"error": "Gmail not configured. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD to .env"}

    to_email = settings.notification_email or settings.gmail_address

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"InvestIntel <{settings.gmail_address}>"
    msg["To"] = to_email

    full_html = f"<html><head>{_EMAIL_STYLE}</head><body><div class='container'>{html_body}</div></body></html>"
    msg.attach(MIMEText(full_html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.gmail_address, settings.gmail_app_password)
            server.send_message(msg)
        return {"status": "sent", "to": to_email, "subject": subject, "sent_at": datetime.now(UTC).isoformat()}
    except Exception as e:
        return {"error": f"Failed to send: {str(e)}"}


def _fmt(n) -> str:
    if n is None: return "—"
    return f"₹{float(n):,.2f}"


# ─── 1. Morning Market Brief ───

def send_morning_brief(db: Session, user_id: int = 1) -> dict:
    """Send morning market brief email. Uses cached DB data — 0 API calls."""
    now = datetime.now(UTC)
    date_str = now.strftime("%B %d, %Y")

    # Market indices
    from ..models import MarketIndex
    indices = db.query(MarketIndex).all()
    indices_html = ""
    for idx in indices:
        chg_class = "gain" if (idx.change_pct or 0) >= 0 else "loss"
        chg_sign = "+" if (idx.change_pct or 0) >= 0 else ""
        indices_html += f"<tr><td><strong>{idx.name}</strong></td><td class='mono'>{_fmt(idx.value)}</td><td class='{chg_class} mono'>{chg_sign}{idx.change_pct or 0:.2f}%</td></tr>"

    # Portfolio summary
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    portfolio_html = ""
    total_invested = Decimal("0")
    total_current = Decimal("0")
    for p in portfolios:
        p_invested = sum(h.quantity * h.buy_price for h in p.holdings)
        p_current = Decimal("0")
        for h in p.holdings:
            cmp = get_cached_price(db, h.symbol)
            if cmp:
                p_current += h.quantity * cmp
        total_invested += p_invested
        total_current += p_current
        pnl = p_current - p_invested
        pnl_pct = float(pnl / p_invested * 100) if p_invested else 0
        pnl_class = "gain" if pnl >= 0 else "loss"
        portfolio_html += f"<tr><td><strong>{p.name}</strong></td><td class='mono'>{_fmt(p_invested)}</td><td class='mono'>{_fmt(p_current)}</td><td class='{pnl_class} mono'>{'+' if pnl >= 0 else ''}{_fmt(pnl)} ({pnl_pct:+.2f}%)</td></tr>"

    total_pnl = total_current - total_invested
    total_pnl_pct = float(total_pnl / total_invested * 100) if total_invested else 0
    mood_class = "gain" if total_pnl >= 0 else "loss"

    # Top movers from popular stocks
    movers_html = ""
    stocks_with_change = []
    for s, n, sec in POPULAR_STOCKS:
        inst = db.query(Instrument).filter(Instrument.symbol == s).first()
        if not inst: continue
        mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).order_by(MarketPrice.fetched_at.desc()).first()
        if mp and mp.price and mp.change_pct:
            stocks_with_change.append({"symbol": s, "name": n, "price": float(mp.price), "change_pct": float(mp.change_pct)})

    gainers = sorted(stocks_with_change, key=lambda x: x["change_pct"], reverse=True)[:3]
    losers = sorted(stocks_with_change, key=lambda x: x["change_pct"])[:3]

    for s in gainers:
        movers_html += f"<tr><td>🟢 <strong>{s['symbol']}</strong></td><td class='mono'>{_fmt(s['price'])}</td><td class='gain mono'>+{s['change_pct']:.2f}%</td></tr>"
    for s in losers:
        movers_html += f"<tr><td>🔴 <strong>{s['symbol']}</strong></td><td class='mono'>{_fmt(s['price'])}</td><td class='loss mono'>{s['change_pct']:.2f}%</td></tr>"

    html = f"""
    <div class="header">
        <h1>📊 InvestIntel — Morning Brief</h1>
        <p>{date_str}</p>
    </div>

    <div class="card">
        <h3>Market Indices</h3>
        <table><tr><th>Index</th><th>Value</th><th>Change</th></tr>{indices_html}</table>
    </div>

    <div class="card">
        <h3>Your Portfolio Summary</h3>
        <table><tr><th>Portfolio</th><th>Invested</th><th>Current</th><th>P&L</th></tr>{portfolio_html}</table>
        <div style="margin-top:12px; padding:10px; background:#0d0d14; border-radius:8px;">
            <span style="color:#64748b; font-size:11px;">Total P&L:</span>
            <span class="{mood_class}" style="font-size:18px; font-weight:700; margin-left:8px;">
                {'+' if total_pnl >= 0 else ''}{_fmt(total_pnl)} ({total_pnl_pct:+.2f}%)
            </span>
        </div>
    </div>

    <div class="card">
        <h3>Top Movers Today</h3>
        <table><tr><th>Stock</th><th>Price</th><th>Change</th></tr>{movers_html}</table>
    </div>

    <div class="footer">InvestIntel AI Research · Not financial advice · {date_str}</div>
    """

    return _send_email(f"📊 InvestIntel — Morning Brief | {date_str}", html)


# ─── 2. Wishlist Buy Signal ───

def send_wishlist_alerts(db: Session, user_id: int = 1) -> dict:
    """Check all wishlist targets and email if any are hit. 0 API calls."""
    watchlists = db.query(Watchlist).filter(Watchlist.user_id == user_id).all()
    alerts = []

    for wl in watchlists:
        for item in wl.items:
            if not item.target_buy_price:
                continue
            sym = resolve_symbol(item.symbol)
            cmp = get_cached_price(db, sym)
            if not cmp:
                continue
            if cmp <= item.target_buy_price:
                diff_pct = float((cmp - item.target_buy_price) / item.target_buy_price * 100)
                alerts.append({
                    "symbol": sym, "watchlist": wl.name,
                    "target": float(item.target_buy_price), "current": float(cmp),
                    "diff_pct": diff_pct, "notes": item.notes,
                })

    if not alerts:
        return {"status": "no_alerts", "message": "No wishlist targets hit"}

    rows = ""
    for a in alerts:
        rows += f"""<tr>
            <td><strong>{a['symbol']}</strong></td>
            <td class="mono">{_fmt(a['target'])}</td>
            <td class="gain mono">{_fmt(a['current'])}</td>
            <td class="gain mono">{a['diff_pct']:.1f}%</td>
            <td style="font-size:11px; color:#64748b;">{a.get('notes') or ''}</td>
        </tr>"""

    html = f"""
    <div class="header">
        <h1>🎯 Wishlist Buy Signals!</h1>
        <p>{len(alerts)} stock(s) hit your target price</p>
    </div>
    <div class="card">
        <h3>Target Price Alerts</h3>
        <table>
            <tr><th>Stock</th><th>Your Target</th><th>Current</th><th>Below Target</th><th>Notes</th></tr>
            {rows}
        </table>
        <div style="margin-top:12px;">
            <span class="badge badge-green">🎯 BUY ZONE — These stocks are at or below your target prices</span>
        </div>
    </div>
    <div class="footer">InvestIntel AI · Check your wishlist for detailed analysis</div>
    """

    return _send_email(f"🎯 {len(alerts)} Wishlist Target(s) Hit! | InvestIntel", html)


# ─── 3. Smart Alert Notification ───

def send_smart_alert_email(alert: dict) -> dict:
    """Send email when a smart alert triggers. 0 API calls."""
    parsed = alert.get("parsed", {})
    html = f"""
    <div class="header">
        <h1>⚡ Smart Alert Triggered!</h1>
        <p>{parsed.get('condition_description', alert.get('raw_text', ''))}</p>
    </div>
    <div class="card">
        <h3>{parsed.get('symbol', 'Stock')} Alert</h3>
        <table>
            <tr><td style="color:#64748b;">Condition</td><td>{alert.get('raw_text', '')}</td></tr>
            <tr><td style="color:#64748b;">Type</td><td><span class="badge badge-purple">{parsed.get('alert_type', 'CUSTOM')}</span></td></tr>
            <tr><td style="color:#64748b;">Target Value</td><td class="mono">{_fmt(parsed.get('condition_value'))}</td></tr>
            <tr><td style="color:#64748b;">Triggered Price</td><td class="gain mono">{_fmt(alert.get('triggered_price'))}</td></tr>
            <tr><td style="color:#64748b;">Triggered At</td><td>{alert.get('triggered_at', '')}</td></tr>
        </table>
    </div>
    <div class="footer">InvestIntel AI · Smart Alert System</div>
    """
    sym = parsed.get("symbol", "Stock")
    return _send_email(f"⚡ Alert: {sym} — {parsed.get('condition_description', 'Triggered')} | InvestIntel", html)


# ─── 4. Weekly Portfolio Report (Saturday 8 AM) ───

def send_weekly_report(db: Session, user_id: int = 1) -> dict:
    """Comprehensive weekly portfolio report. 0 API calls — all from DB."""
    now = datetime.now(UTC)
    date_str = now.strftime("%B %d, %Y")

    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    if not portfolios:
        return {"status": "no_portfolios"}

    all_holdings_html = ""
    grand_invested = Decimal("0")
    grand_current = Decimal("0")
    best_performer = {"symbol": "", "pnl_pct": -999}
    worst_performer = {"symbol": "", "pnl_pct": 999}
    sector_totals: dict[str, float] = {}

    for p in portfolios:
        for h in p.holdings:
            sym = resolve_symbol(h.symbol)
            invested = h.quantity * h.buy_price
            grand_invested += invested
            cmp = get_cached_price(db, sym)
            current = h.quantity * cmp if cmp else Decimal("0")
            grand_current += current
            pnl = current - invested if cmp else Decimal("0")
            pnl_pct = float(pnl / invested * 100) if invested and cmp else 0
            pnl_class = "gain" if pnl >= 0 else "loss"

            inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
            sector = inst.sector if inst and inst.sector else "Other"
            sector_totals[sector] = sector_totals.get(sector, 0) + float(current)

            if pnl_pct > best_performer["pnl_pct"]:
                best_performer = {"symbol": sym, "pnl_pct": pnl_pct, "pnl": float(pnl)}
            if pnl_pct < worst_performer["pnl_pct"]:
                worst_performer = {"symbol": sym, "pnl_pct": pnl_pct, "pnl": float(pnl)}

            all_holdings_html += f"""<tr>
                <td><strong>{sym}</strong><br><span style="font-size:10px;color:#64748b;">{p.name}</span></td>
                <td class="mono">{int(h.quantity)}</td>
                <td class="mono">{_fmt(h.buy_price)}</td>
                <td class="mono">{_fmt(cmp)}</td>
                <td class="{pnl_class} mono">{'+' if pnl >= 0 else ''}{_fmt(pnl)}<br><span style="font-size:10px;">({pnl_pct:+.1f}%)</span></td>
            </tr>"""

    grand_pnl = grand_current - grand_invested
    grand_pnl_pct = float(grand_pnl / grand_invested * 100) if grand_invested else 0
    pnl_class = "gain" if grand_pnl >= 0 else "loss"

    # Sector distribution
    sector_html = ""
    total_cur = float(grand_current) or 1
    colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#64748b"]
    for i, (sec, val) in enumerate(sorted(sector_totals.items(), key=lambda x: -x[1])):
        pct = val / total_cur * 100
        color = colors[i % len(colors)]
        sector_html += f'<div style="display:inline-block; margin:4px 8px 4px 0;"><span style="display:inline-block;width:10px;height:10px;background:{color};border-radius:2px;margin-right:4px;"></span><span style="font-size:11px;color:#94a3b8;">{sec} {pct:.1f}%</span></div>'

    # Wishlist summary
    watchlists = db.query(Watchlist).filter(Watchlist.user_id == user_id).all()
    targets_hit = 0
    total_watched = 0
    for wl in watchlists:
        for item in wl.items:
            total_watched += 1
            if item.target_buy_price:
                cmp = get_cached_price(db, resolve_symbol(item.symbol))
                if cmp and cmp <= item.target_buy_price:
                    targets_hit += 1

    html = f"""
    <div class="header">
        <h1>📈 Weekly Portfolio Report</h1>
        <p>Week ending {date_str}</p>
    </div>

    <div class="card">
        <h3>Portfolio Overview</h3>
        <table>
            <tr><td style="color:#64748b;">Total Invested</td><td class="mono" style="font-size:16px;"><strong>{_fmt(grand_invested)}</strong></td></tr>
            <tr><td style="color:#64748b;">Current Value</td><td class="mono" style="font-size:16px;"><strong>{_fmt(grand_current)}</strong></td></tr>
            <tr><td style="color:#64748b;">Total P&L</td><td class="{pnl_class} mono" style="font-size:18px;"><strong>{'+' if grand_pnl >= 0 else ''}{_fmt(grand_pnl)} ({grand_pnl_pct:+.2f}%)</strong></td></tr>
        </table>
    </div>

    <div class="card" style="display:flex; gap:12px;">
        <div style="flex:1; background:#0d0d14; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b;">Best Performer</div>
            <div class="gain" style="font-size:16px; font-weight:700;">{best_performer['symbol']}</div>
            <div class="gain mono" style="font-size:12px;">{best_performer['pnl_pct']:+.1f}%</div>
        </div>
        <div style="flex:1; background:#0d0d14; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b;">Worst Performer</div>
            <div class="loss" style="font-size:16px; font-weight:700;">{worst_performer['symbol']}</div>
            <div class="loss mono" style="font-size:12px;">{worst_performer['pnl_pct']:+.1f}%</div>
        </div>
        <div style="flex:1; background:#0d0d14; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b;">Wishlist Targets</div>
            <div style="font-size:16px; font-weight:700; color:#f59e0b;">{targets_hit}/{total_watched}</div>
            <div style="font-size:10px; color:#64748b;">hit buy zone</div>
        </div>
    </div>

    <div class="card">
        <h3>Sector Distribution</h3>
        {sector_html}
    </div>

    <div class="card">
        <h3>All Holdings</h3>
        <table>
            <tr><th>Stock</th><th>Qty</th><th>Buy</th><th>CMP</th><th>P&L</th></tr>
            {all_holdings_html}
        </table>
    </div>

    <div class="footer">InvestIntel AI Research · Weekly Report · Not financial advice · {date_str}</div>
    """

    return _send_email(f"📈 Weekly Portfolio Report — {'+' if grand_pnl >= 0 else ''}{_fmt(grand_pnl)} ({grand_pnl_pct:+.1f}%) | InvestIntel", html)


# ─── Check & Send All Notifications (called after price refresh) ───

def check_and_send_notifications(db: Session, user_id: int = 1) -> dict:
    """Run after each price refresh — checks wishlist targets + smart alerts, sends emails if triggered."""
    results = {"wishlist_alerts": None, "smart_alerts": []}

    # Check wishlist targets
    wl_result = send_wishlist_alerts(db, user_id)
    results["wishlist_alerts"] = wl_result

    # Check smart alerts
    from ..services.ai_intelligence_service import check_alerts
    triggered = check_alerts(db, user_id)
    for alert in triggered:
        email_result = send_smart_alert_email(alert)
        results["smart_alerts"].append(email_result)

    return results

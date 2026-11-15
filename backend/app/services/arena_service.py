from datetime import UTC, datetime
from decimal import Decimal
import math
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    ArenaSandbox,
    ArenaPosition,
    ArenaTrade,
    Instrument,
    MarketPrice,
    WatchlistItem,
    Watchlist,
)
from ..schemas import (
    ArenaSandboxCreate,
    ArenaSandboxUpdate,
    ArenaPositionUpdate,
    ArenaOrderCreate,
    ArenaImportAIPicks,
    ArenaPositionOut,
    ArenaTradeOut,
    ArenaSandboxDetail,
    ArenaSandboxSummary,
    ArenaLeaderboardItem,
)
from .market_service import resolve_symbol, get_cached_price, _fetch_quote_fast, update_stock_market_price, get_live_or_cached_price


def seed_default_sandboxes_if_empty(db: Session, user_id: int = 1) -> list[ArenaSandbox]:
    """Ensure user has default starter sandboxes if none exist."""
    existing = db.query(ArenaSandbox).filter(ArenaSandbox.user_id == user_id).all()
    if existing:
        return existing

    starter_configs = [
        {
            "name": "🎯 My Discretionary Intuition",
            "description": "User discretionary swing & value picks based on manual analysis & chart patterns.",
            "category": "USER_INTUITION",
            "horizon": "1M",
            "initial_capital": Decimal("100000.00"),
            "current_cash": Decimal("100000.00"),
            "auto_execute": True,
        },
        {
            "name": "🤖 AI Institutional Engine",
            "description": "Systematic portfolio driven by Dalal Street 3-pillar quant scores and automated targets.",
            "category": "AI_INSTITUTIONAL",
            "horizon": "1M",
            "initial_capital": Decimal("100000.00"),
            "current_cash": Decimal("100000.00"),
            "auto_execute": True,
        },
        {
            "name": "🎲 Market Rumors & Tips",
            "description": "Experimental sandbox benchmarking social media tips and broker recommendations.",
            "category": "MARKET_TIPS",
            "horizon": "1M",
            "initial_capital": Decimal("100000.00"),
            "current_cash": Decimal("100000.00"),
            "auto_execute": True,
        },
    ]

    created = []
    for cfg in starter_configs:
        sb = ArenaSandbox(
            user_id=user_id,
            name=cfg["name"],
            description=cfg["description"],
            category=cfg["category"],
            horizon=cfg["horizon"],
            initial_capital=cfg["initial_capital"],
            current_cash=cfg["current_cash"],
            auto_execute=cfg["auto_execute"],
            is_active=True,
        )
        db.add(sb)
        created.append(sb)
    db.commit()
    for s in created:
        db.refresh(s)
    return created


def create_sandbox(db: Session, user_id: int, data: ArenaSandboxCreate) -> ArenaSandbox:
    init_cap = Decimal(str(round(max(100.0, data.initial_capital), 2)))
    sb = ArenaSandbox(
        user_id=user_id,
        name=data.name.strip(),
        description=data.description,
        category=data.category,
        horizon=data.horizon,
        initial_capital=init_cap,
        current_cash=init_cap,
        auto_execute=data.auto_execute,
        is_active=True,
    )
    db.add(sb)
    db.commit()
    db.refresh(sb)
    return sb


def list_sandboxes(db: Session, user_id: int) -> list[ArenaSandboxSummary]:
    seed_default_sandboxes_if_empty(db, user_id)
    sandboxes = (
        db.query(ArenaSandbox)
        .filter(ArenaSandbox.user_id == user_id, ArenaSandbox.is_active.is_(True))
        .order_by(ArenaSandbox.position_order.asc(), ArenaSandbox.id.asc())
        .all()
    )

    summaries = []
    for sb in sandboxes:
        detail = get_sandbox_detail(db, sb.id)
        if detail:
            summaries.append(
                ArenaSandboxSummary(
                    id=detail.id,
                    name=detail.name,
                    category=detail.category,
                    horizon=detail.horizon,
                    initial_capital=detail.initial_capital,
                    current_cash=detail.current_cash,
                    invested_capital=detail.invested_capital,
                    total_value=detail.total_value,
                    total_pnl=detail.total_pnl,
                    total_pnl_pct=detail.total_pnl_pct,
                    win_rate_pct=detail.win_rate_pct,
                    position_count=len(detail.positions),
                    trade_count=detail.trade_count,
                    auto_execute=detail.auto_execute,
                    position_order=sb.position_order,
                    created_at=detail.created_at,
                )
            )
    return summaries


def get_sandbox_detail(db: Session, sandbox_id: int) -> ArenaSandboxDetail | None:
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        return None

    positions_out: list[ArenaPositionOut] = []
    invested_capital = Decimal("0")
    total_unrealized_pnl = Decimal("0")
    current_positions_value = Decimal("0")

    for pos in sb.positions:
        cmp = get_live_or_cached_price(db, pos.symbol)
        invested = pos.avg_buy_price * pos.quantity
        curr_val = cmp * pos.quantity
        unrealized = curr_val - invested
        unrealized_pct = float((unrealized / invested) * Decimal("100")) if invested > 0 else 0.0

        dist_target_pct = None
        if pos.target_sell_price and pos.target_sell_price > Decimal("0") and cmp > Decimal("0"):
            dist_target_pct = round(float(((pos.target_sell_price - cmp) / cmp) * Decimal("100")), 2)

        dist_stop_pct = None
        if pos.stop_loss_price and pos.stop_loss_price > Decimal("0") and cmp > Decimal("0"):
            dist_stop_pct = round(float(((pos.stop_loss_price - cmp) / cmp) * Decimal("100")), 2)

        invested_capital += invested
        current_positions_value += curr_val
        total_unrealized_pnl += unrealized

        positions_out.append(
            ArenaPositionOut(
                id=pos.id,
                sandbox_id=pos.sandbox_id,
                symbol=pos.symbol,
                name=pos.name or pos.symbol,
                quantity=pos.quantity,
                avg_buy_price=pos.avg_buy_price,
                current_price=cmp,
                invested_amount=invested,
                current_value=curr_val,
                unrealized_pnl=unrealized,
                unrealized_pnl_pct=round(unrealized_pct, 2),
                target_sell_price=pos.target_sell_price,
                ai_target_price=pos.ai_target_price or pos.target_sell_price,
                custom_target_price=pos.custom_target_price,
                stop_loss_price=pos.stop_loss_price,
                distance_to_target_pct=dist_target_pct,
                distance_to_stop_pct=dist_stop_pct,
                horizon=pos.horizon,
                rationale=pos.rationale,
                ai_score=pos.ai_score,
                created_at=pos.created_at,
            )
        )

    trades_out: list[ArenaTradeOut] = []
    realized_pnl_total = Decimal("0")
    winning_trades = 0
    closed_trades = 0

    for tr in sb.trades:
        total_amt = tr.quantity * tr.price
        if tr.trade_type != "BUY":
            closed_trades += 1
            realized_pnl_total += tr.realized_pnl
            if tr.realized_pnl > Decimal("0"):
                winning_trades += 1

        trades_out.append(
            ArenaTradeOut(
                id=tr.id,
                sandbox_id=tr.sandbox_id,
                symbol=tr.symbol,
                trade_type=tr.trade_type,
                quantity=tr.quantity,
                price=tr.price,
                total_amount=total_amt,
                realized_pnl=tr.realized_pnl,
                realized_pnl_pct=tr.realized_pnl_pct,
                notes=tr.notes,
                executed_at=tr.executed_at,
            )
        )

    # Sort trades descending by executed_at
    trades_out.sort(key=lambda t: t.executed_at, reverse=True)

    win_rate_pct = round((winning_trades / closed_trades * 100), 1) if closed_trades > 0 else 0.0

    total_value = sb.current_cash + current_positions_value
    total_pnl = total_value - sb.initial_capital
    total_pnl_pct = (
        round(float((total_pnl / sb.initial_capital) * Decimal("100")), 2)
        if sb.initial_capital > Decimal("0")
        else 0.0
    )

    return ArenaSandboxDetail(
        id=sb.id,
        user_id=sb.user_id,
        name=sb.name,
        description=sb.description,
        category=sb.category,
        horizon=sb.horizon,
        initial_capital=sb.initial_capital,
        current_cash=sb.current_cash,
        invested_capital=invested_capital,
        total_value=total_value,
        total_pnl=total_pnl,
        total_pnl_pct=total_pnl_pct,
        realized_pnl=realized_pnl_total,
        unrealized_pnl=total_unrealized_pnl,
        win_rate_pct=win_rate_pct,
        trade_count=len(sb.trades),
        auto_execute=sb.auto_execute,
        position_order=sb.position_order,
        is_active=sb.is_active,
        created_at=sb.created_at,
        positions=positions_out,
        trades=trades_out,
    )


def update_sandbox(db: Session, sandbox_id: int, data: ArenaSandboxUpdate) -> ArenaSandbox | None:
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        return None
    if data.name is not None and data.name.strip():
        sb.name = data.name.strip()
    if data.description is not None:
        sb.description = data.description
    if data.auto_execute is not None:
        sb.auto_execute = data.auto_execute
    if data.horizon is not None:
        sb.horizon = data.horizon
    if data.position_order is not None:
        sb.position_order = data.position_order
    sb.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(sb)
    return sb


def reorder_sandboxes(db: Session, user_id: int, sandbox_ids: list[int]) -> bool:
    """Persist custom drag-and-drop order of sandboxes."""
    for order, s_id in enumerate(sandbox_ids):
        sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == s_id, ArenaSandbox.user_id == user_id).first()
        if sb:
            sb.position_order = order
    db.commit()
    return True


def update_position(db: Session, sandbox_id: int, position_id: int, data: ArenaPositionUpdate) -> ArenaPosition | None:
    """
    Update position quantity (with automatic cash debit/credit) or targets.
    - If quantity increases: checks cash, deducts cost, updates avg buy price, logs BUY trade.
    - If quantity decreases: sells partial shares, credits proceeds to cash, logs SELL trade.
    - If custom target is updated: saves custom target and updates active target_sell_price.
    """
    pos = db.query(ArenaPosition).filter(
        ArenaPosition.id == position_id,
        ArenaPosition.sandbox_id == sandbox_id
    ).first()
    if not pos:
        raise ValueError(f"Position {position_id} not found in sandbox {sandbox_id}")

    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    cmp = get_live_or_cached_price(db, pos.symbol)

    # 1. Quantity change
    if data.quantity is not None:
        new_qty = Decimal(str(round(data.quantity, 4)))
        if new_qty < Decimal("0"):
            raise ValueError("Quantity cannot be negative")

        current_qty = pos.quantity
        if new_qty > current_qty:
            delta_qty = new_qty - current_qty
            cost = delta_qty * cmp
            current_invested = sum((p.avg_buy_price * p.quantity) for p in sb.positions)
            if sb.initial_capital and (current_invested + cost) > sb.initial_capital:
                raise ValueError(f"Cannot increase quantity: total invested would exceed starting cash (₹{sb.initial_capital:,.2f})")
            if cost > sb.current_cash:
                raise ValueError(f"Insufficient cash to increase quantity. Required: ₹{cost:,.2f}, Available: ₹{sb.current_cash:,.2f}")
            # Deduct cash
            sb.current_cash -= cost
            # Recalculate average buy price
            total_cost = (pos.avg_buy_price * current_qty) + cost
            pos.avg_buy_price = total_cost / new_qty
            pos.quantity = new_qty
            # Log BUY trade
            trade = ArenaTrade(
                sandbox_id=sandbox_id,
                symbol=pos.symbol,
                trade_type="BUY",
                quantity=delta_qty,
                price=cmp,
                realized_pnl=Decimal("0"),
                realized_pnl_pct=0.0,
                notes=f"Increased position by +{delta_qty} shares @ ₹{cmp:.2f}",
                executed_at=datetime.now(UTC),
            )
            db.add(trade)
        elif new_qty < current_qty:
            reduced_qty = current_qty - new_qty
            # Refund exact invested cost to available cash (NO profit/loss booked on quantity adjustment)
            refund_cost = reduced_qty * pos.avg_buy_price
            sb.current_cash += refund_cost

            if new_qty == Decimal("0"):
                db.delete(pos)
                sb.updated_at = datetime.now(UTC)
                db.commit()
                return None
            else:
                pos.quantity = new_qty

    # 2. Custom Target Price
    if data.custom_target_price is not None:
        custom_tgt = Decimal(str(round(data.custom_target_price, 2))) if data.custom_target_price > 0 else None
        pos.custom_target_price = custom_tgt
        if custom_tgt:
            pos.target_sell_price = custom_tgt

    # 3. Stop Loss Price
    if data.stop_loss_price is not None:
        pos.stop_loss_price = Decimal(str(round(data.stop_loss_price, 2))) if data.stop_loss_price > 0 else None

    sb.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(pos)
    return pos


def adjust_capital(db: Session, sandbox_id: int, amount: float) -> ArenaSandbox | None:
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        return None
    delta = Decimal(str(round(amount, 2)))
    new_cash = sb.current_cash + delta
    if new_cash < Decimal("0"):
        raise ValueError(f"Insufficient cash in sandbox. Available: ₹{sb.current_cash}")
    sb.current_cash = new_cash
    sb.initial_capital += delta
    sb.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(sb)
    return sb


def buy_stock(db: Session, sandbox_id: int, order: ArenaOrderCreate) -> ArenaPosition:
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        raise ValueError(f"Sandbox {sandbox_id} not found")

    sym = resolve_symbol(order.symbol)
    qty = Decimal(str(round(order.quantity, 4)))
    if qty <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero")

    # Determine execution price
    cmp = get_live_or_cached_price(db, sym)
    if order.custom_buy_price and order.custom_buy_price > 0:
        # Guard against stale dummy 1000.0 or corrupted client fallback:
        # If client passed 1000.0 but actual cmp is substantially different, use authentic CMP
        if order.custom_buy_price == 1000.0 and abs(1000.0 - float(cmp)) > 50.0:
            exec_price = cmp
        else:
            exec_price = Decimal(str(round(order.custom_buy_price, 2)))
    else:
        exec_price = cmp

    cost = exec_price * qty
    current_invested = sum((p.avg_buy_price * p.quantity) for p in sb.positions)
    if sb.initial_capital and (current_invested + cost) > sb.initial_capital:
        avail_capacity = max(Decimal("0"), sb.initial_capital - current_invested)
        raise ValueError(
            f"Order would exceed Total Starting Cash limit. "
            f"Already invested: ₹{current_invested:,.2f}, New order: ₹{cost:,.2f}, "
            f"Starting cash: ₹{sb.initial_capital:,.2f} (Available capacity: ₹{avail_capacity:,.2f})"
        )
    if cost > sb.current_cash:
        raise ValueError(f"Insufficient cash: Required ₹{cost:,.2f}, Available ₹{sb.current_cash:,.2f}")

    # Deduct cash
    sb.current_cash -= cost
    sb.updated_at = datetime.now(UTC)

    # Get instrument details if available
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    stock_name = inst.name if inst else sym

    # Parse targets
    target_price = (
        Decimal(str(round(order.target_sell_price, 2)))
        if order.target_sell_price and order.target_sell_price > 0
        else None
    )
    stop_price = (
        Decimal(str(round(order.stop_loss_price, 2)))
        if order.stop_loss_price and order.stop_loss_price > 0
        else None
    )

    # Check if position already exists
    pos = db.query(ArenaPosition).filter(
        ArenaPosition.sandbox_id == sandbox_id,
        ArenaPosition.symbol == sym
    ).first()

    if pos:
        total_qty = pos.quantity + qty
        total_cost = (pos.avg_buy_price * pos.quantity) + cost
        pos.avg_buy_price = total_cost / total_qty
        pos.quantity = total_qty
        if target_price:
            pos.target_sell_price = target_price
        if stop_price:
            pos.stop_loss_price = stop_price
        if order.horizon:
            pos.horizon = order.horizon
        if order.rationale:
            pos.rationale = order.rationale
    else:
        pos = ArenaPosition(
            sandbox_id=sandbox_id,
            symbol=sym,
            name=stock_name,
            quantity=qty,
            avg_buy_price=exec_price,
            target_sell_price=target_price,
            ai_target_price=target_price,
            custom_target_price=None,
            stop_loss_price=stop_price,
            horizon=order.horizon or sb.horizon,
            rationale=order.rationale,
            created_at=datetime.now(UTC),
        )
        db.add(pos)

    # Record trade
    trade = ArenaTrade(
        sandbox_id=sandbox_id,
        symbol=sym,
        trade_type="BUY",
        quantity=qty,
        price=exec_price,
        realized_pnl=Decimal("0"),
        realized_pnl_pct=0.0,
        notes=f"Bought {qty} shares @ ₹{exec_price:.2f}. Rationale: {order.rationale or 'Manual Order'}",
        executed_at=datetime.now(UTC),
    )
    db.add(trade)

    db.commit()
    db.refresh(pos)
    return pos


def sell_position(
    db: Session,
    sandbox_id: int,
    position_id: int,
    trade_type: str = "SELL_MANUAL",
    custom_price: float | None = None,
    notes: str | None = None,
) -> ArenaTrade:
    pos = db.query(ArenaPosition).filter(
        ArenaPosition.id == position_id,
        ArenaPosition.sandbox_id == sandbox_id
    ).first()
    if not pos:
        raise ValueError(f"Position {position_id} not found in sandbox {sandbox_id}")

    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()

    sym = pos.symbol
    if custom_price and custom_price > 0:
        exec_price = Decimal(str(round(custom_price, 2)))
    else:
        exec_price = get_live_or_cached_price(db, sym)

    qty = pos.quantity
    proceeds = exec_price * qty
    invested = pos.avg_buy_price * qty
    realized_pnl = proceeds - invested
    realized_pnl_pct = (
        round(float((realized_pnl / invested) * Decimal("100")), 2)
        if invested > Decimal("0")
        else 0.0
    )

    # Credit proceeds to sandbox
    sb.current_cash += proceeds
    sb.updated_at = datetime.now(UTC)

    # Trade record
    default_notes = {
        "SELL_TARGET_HIT": f"🎯 Target Hit! Sold {qty} shares @ ₹{exec_price:.2f} (Bought @ ₹{pos.avg_buy_price:.2f})",
        "SELL_STOP_LOSS": f"🛑 Stop-Loss Hit! Sold {qty} shares @ ₹{exec_price:.2f} to protect capital (Bought @ ₹{pos.avg_buy_price:.2f})",
        "SELL_MANUAL": f"Sold {qty} shares @ ₹{exec_price:.2f} manually (Bought @ ₹{pos.avg_buy_price:.2f})",
    }

    trade = ArenaTrade(
        sandbox_id=sandbox_id,
        symbol=sym,
        trade_type=trade_type,
        quantity=qty,
        price=exec_price,
        realized_pnl=realized_pnl,
        realized_pnl_pct=realized_pnl_pct,
        notes=notes or default_notes.get(trade_type, "Exited position"),
        executed_at=datetime.now(UTC),
    )
    db.add(trade)

    # Remove position
    db.delete(pos)
    db.commit()
    db.refresh(trade)
    return trade


def delete_position_and_refund(db: Session, sandbox_id: int, position_id: int) -> None:
    """
    Completely removes a position from the sandbox throughout.
    The exact original invested amount (quantity * avg_buy_price) is returned directly
    to balance remaining (current_cash).
    No profit or loss is booked.
    """
    pos = db.query(ArenaPosition).filter(
        ArenaPosition.id == position_id,
        ArenaPosition.sandbox_id == sandbox_id,
    ).first()
    if not pos:
        raise ValueError(f"Position {position_id} not found in sandbox {sandbox_id}")

    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        raise ValueError(f"Sandbox {sandbox_id} not found")

    invested_cost = pos.avg_buy_price * pos.quantity
    sb.current_cash += invested_cost
    sb.updated_at = datetime.now(UTC)

    sym = pos.symbol
    # Clean up any manual sell trades that booked fake pnl for this symbol in this sandbox
    db.query(ArenaTrade).filter(
        ArenaTrade.sandbox_id == sandbox_id,
        ArenaTrade.symbol == sym,
        ArenaTrade.trade_type == "SELL_MANUAL",
    ).delete(synchronize_session=False)

    db.delete(pos)
    db.commit()


def reset_sandbox(db: Session, sandbox_id: int) -> ArenaSandbox:
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        raise ValueError(f"Sandbox {sandbox_id} not found")

    # Delete all positions and trades
    db.query(ArenaPosition).filter(ArenaPosition.sandbox_id == sandbox_id).delete()
    db.query(ArenaTrade).filter(ArenaTrade.sandbox_id == sandbox_id).delete()

    # Reset cash
    sb.current_cash = sb.initial_capital
    sb.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(sb)
    return sb


def delete_sandbox(db: Session, sandbox_id: int) -> bool:
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        return False
    db.delete(sb)
    db.commit()
    return True


def check_and_execute_arena_triggers(db: Session) -> list[dict]:
    """
    Automatic trigger evaluation daemon.
    Iterates all active sandboxes with auto_execute=True and checks if live CMP
    has hit the target_sell_price (take profit) or stop_loss_price (stop loss).
    """
    active_sandboxes = (
        db.query(ArenaSandbox)
        .filter(ArenaSandbox.auto_execute.is_(True), ArenaSandbox.is_active.is_(True))
        .all()
    )

    triggered_trades = []

    for sb in active_sandboxes:
        # Check positions
        positions = list(sb.positions)
        for pos in positions:
            cmp = get_cached_price(db, pos.symbol)
            if not cmp or cmp <= Decimal("0"):
                continue

            # 1. Target Hit (Take profit)
            if pos.target_sell_price and pos.target_sell_price > Decimal("0") and cmp >= pos.target_sell_price:
                trade = sell_position(
                    db=db,
                    sandbox_id=sb.id,
                    position_id=pos.id,
                    trade_type="SELL_TARGET_HIT",
                    custom_price=float(cmp),
                    notes=f"🎯 Target Hit! Sold @ ₹{cmp:.2f} (Target was ₹{pos.target_sell_price:.2f})",
                )
                triggered_trades.append({
                    "sandbox_id": sb.id,
                    "sandbox_name": sb.name,
                    "symbol": pos.symbol,
                    "trigger": "TARGET_HIT",
                    "price": float(cmp),
                    "pnl": float(trade.realized_pnl),
                    "pnl_pct": trade.realized_pnl_pct,
                })
                print(f"[arena-auto-pilot] 🎯 TARGET HIT: {sb.name} sold {pos.symbol} @ ₹{cmp} (P&L: ₹{trade.realized_pnl:,.2f})")

            # 2. Stop Loss Hit (Capital preservation)
            elif pos.stop_loss_price and pos.stop_loss_price > Decimal("0") and cmp <= pos.stop_loss_price:
                trade = sell_position(
                    db=db,
                    sandbox_id=sb.id,
                    position_id=pos.id,
                    trade_type="SELL_STOP_LOSS",
                    custom_price=float(cmp),
                    notes=f"🛑 Stop Loss Triggered! Sold @ ₹{cmp:.2f} (Stop was ₹{pos.stop_loss_price:.2f})",
                )
                triggered_trades.append({
                    "sandbox_id": sb.id,
                    "sandbox_name": sb.name,
                    "symbol": pos.symbol,
                    "trigger": "STOP_LOSS",
                    "price": float(cmp),
                    "pnl": float(trade.realized_pnl),
                    "pnl_pct": trade.realized_pnl_pct,
                })
                print(f"[arena-auto-pilot] 🛑 STOP LOSS HIT: {sb.name} sold {pos.symbol} @ ₹{cmp} (P&L: ₹{trade.realized_pnl:,.2f})")

    return triggered_trades


def import_ai_picks_into_sandbox(
    db: Session,
    sandbox_id: int,
    horizon: str = "1M",
    min_score: int = 65,
    allocation_pct: float = 20.0,
    max_stocks: int = 5,
) -> list[ArenaPosition]:
    """
    1-Click Import AI Institutional Conviction stocks into sandbox:
    Evaluates 3-pillar quant scores, pulls horizon price targets & stop-losses,
    and automatically executes simulated buys using allocated virtual capital.
    """
    sb = db.query(ArenaSandbox).filter(ArenaSandbox.id == sandbox_id).first()
    if not sb:
        raise ValueError(f"Sandbox {sandbox_id} not found")

    # Gather candidates from user's watchlist or top blue chips
    candidates = []
    wl_items = db.query(WatchlistItem).all()
    for w in wl_items:
        if w.symbol not in candidates:
            candidates.append(w.symbol)

    # Add standard high-liquidity large caps if candidates is small
    default_pool = ["RELIANCE", "HDFCBANK", "TCS", "INFY", "ITC", "LT", "ICICIBANK", "BHARTIARTL", "SBIN", "TATAMOTORS"]
    for sym in default_pool:
        if sym not in candidates:
            candidates.append(sym)

    from .ai_strategy_service import compute_2year_deep_analysis

    scored_candidates = []
    for sym in candidates:
        try:
            deep = compute_2year_deep_analysis(sym, db)
            score = deep.get("composite_score", 0)
            if score >= min_score:
                scored_candidates.append({
                    "symbol": sym,
                    "score": score,
                    "verdict": deep.get("recommendation", "BUY"),
                    "dossier": deep,
                })
        except Exception:
            continue

    # Sort descending by institutional score
    scored_candidates.sort(key=lambda x: x["score"], reverse=True)
    top_picks = scored_candidates[:max_stocks]

    if not top_picks:
        raise ValueError("No stocks met the minimum institutional conviction score.")

    # Calculate capital per stock
    # Allocate up to allocation_pct per stock from current cash
    avail_cash = float(sb.current_cash)
    if avail_cash <= 0:
        raise ValueError("No available virtual cash to invest.")

    capital_per_stock = avail_cash * (min(100.0, max(5.0, allocation_pct)) / 100.0)

    imported_positions = []

    # Target multipliers by horizon
    horizon_multipliers = {
        "1W": {"target": 1.04, "stop": 0.98},
        "1M": {"target": 1.08, "stop": 0.95},
        "3M": {"target": 1.15, "stop": 0.92},
        "6M": {"target": 1.25, "stop": 0.88},
        "1Y": {"target": 1.38, "stop": 0.85},
    }
    mult = horizon_multipliers.get(horizon, horizon_multipliers["1M"])

    for pick in top_picks:
        sym = pick["symbol"]
        score = pick["score"]

        # Check if already in sandbox
        already_held = db.query(ArenaPosition).filter(
            ArenaPosition.sandbox_id == sandbox_id,
            ArenaPosition.symbol == sym
        ).first()
        if already_held:
            continue

        cmp = get_live_or_cached_price(db, sym)
        if cmp <= Decimal("0"):
            continue

        float_cmp = float(cmp)
        qty = math.floor(capital_per_stock / float_cmp)
        if qty < 1:
            continue

        target_price = round(float_cmp * mult["target"], 2)
        stop_price = round(float_cmp * mult["stop"], 2)

        order = ArenaOrderCreate(
            symbol=sym,
            quantity=float(qty),
            target_sell_price=target_price,
            stop_loss_price=stop_price,
            horizon=horizon,
            rationale=f"AI 3-Pillar Institutional Conviction {score}/100 ({pick['verdict']}). Automated target for {horizon} horizon.",
        )

        try:
            pos = buy_stock(db, sandbox_id, order)
            pos.ai_score = score
            db.commit()
            imported_positions.append(pos)
        except Exception as e:
            print(f"[arena-import-ai] Skipped {sym}: {e}")

    return imported_positions


def get_leaderboard(db: Session, user_id: int) -> list[ArenaLeaderboardItem]:
    """
    Ranks all sandboxes by total Net Return %, showing who is outperforming:
    Intuition vs AI Recommendations vs Market Rumors.
    """
    summaries = list_sandboxes(db, user_id)
    # Sort by total_pnl_pct descending
    summaries.sort(key=lambda s: s.total_pnl_pct, reverse=True)

    leaderboard = []
    for rank, s in enumerate(summaries, start=1):
        leaderboard.append(
            ArenaLeaderboardItem(
                id=s.id,
                name=s.name,
                category=s.category,
                horizon=s.horizon,
                initial_capital=s.initial_capital,
                total_value=s.total_value,
                total_pnl=s.total_pnl,
                total_pnl_pct=s.total_pnl_pct,
                win_rate_pct=s.win_rate_pct,
                trade_count=s.trade_count,
                rank=rank,
            )
        )
    return leaderboard


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
        results.append({
            "symbol": item.symbol,
            "name": item.notes or item.symbol,
            "tab": "My Wishlist",
            "score": 82,
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
    from ..models import Holding, Portfolio
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
        results.append({
            "symbol": h.symbol,
            "name": h.symbol,
            "tab": "My Portfolio",
            "score": 85,
            "verdict": "HOLDING",
            "current_price": cmp,
            "target_buy_price": round(cmp * 0.96, 2),
            "target_sell_price": round(cmp * 1.15, 2),
            "stop_loss_price": round(cmp * 0.93, 2),
            "rationale": f"Current holding ({float(h.quantity)} shares @ ₹{float(h.buy_price):,.2f})",
        })
    return results



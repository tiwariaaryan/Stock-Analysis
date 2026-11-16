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
    Holding,
    AITelecastVault,
)
from ..schemas import ArenaOrderCreate
from .market_service import resolve_symbol, get_cached_price, _fetch_quote_fast, update_stock_market_price, get_live_or_cached_price


def resolve_stock_ai_score(db: Session, symbol: str, fallback: int | None = None) -> int:
    """Resolve authentic multi-factor AI score from AI Telecast Vault, Watchlist, or Holding."""
    sym = resolve_symbol(symbol).upper()
    bare_sym = sym.replace(".NS", "").replace(".BO", "")

    # 1. Search AITelecastVault by symbol or bare_sym
    vault = (
        db.query(AITelecastVault)
        .filter((AITelecastVault.symbol == sym) | (AITelecastVault.symbol == bare_sym))
        .order_by(AITelecastVault.id.desc())
        .first()
    )
    if vault and vault.current_ai_score:
        return vault.current_ai_score

    # 2. Check WatchlistItem
    wl = (
        db.query(WatchlistItem)
        .filter((WatchlistItem.symbol == sym) | (WatchlistItem.symbol == bare_sym))
        .order_by(WatchlistItem.id.desc())
        .first()
    )
    if wl and wl.ai_entry_score:
        return wl.ai_entry_score

    # 3. Check Holding
    h = (
        db.query(Holding)
        .filter((Holding.symbol == sym) | (Holding.symbol == bare_sym))
        .order_by(Holding.id.desc())
        .first()
    )
    if h and h.ai_entry_score:
        return h.ai_entry_score

    return fallback if fallback is not None else 88


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

    # Resolve authentic AI score
    score_to_use = order.ai_score if order.ai_score is not None else resolve_stock_ai_score(db, sym)

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
        pos.created_at = datetime.now(UTC)
        if pos.ai_score is None:
            pos.ai_score = score_to_use
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
            ai_score=score_to_use,
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

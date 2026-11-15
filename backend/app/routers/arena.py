from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    ArenaSandboxCreate,
    ArenaSandboxUpdate,
    ArenaPositionUpdate,
    ArenaReorderRequest,
    ArenaOrderCreate,
    ArenaImportAIPicks,
    ArenaCapitalAdjust,
    ArenaSandboxDetail,
    ArenaSandboxSummary,
    ArenaPositionOut,
    ArenaTradeOut,
    ArenaLeaderboardItem,
)
from ..services import arena_service

router = APIRouter(prefix="/api/v1/arena", tags=["arena"])


@router.get("/sandboxes", response_model=list[ArenaSandboxSummary])
def list_sandboxes(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """List all paper trading sandboxes for the active user."""
    return arena_service.list_sandboxes(db, user_id=user_id)


@router.post("/sandboxes", response_model=ArenaSandboxDetail)
def create_sandbox(data: ArenaSandboxCreate, user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """Create a new paper trading sandbox with custom capital and rules."""
    sb = arena_service.create_sandbox(db, user_id=user_id, data=data)
    detail = arena_service.get_sandbox_detail(db, sb.id)
    if not detail:
        raise HTTPException(status_code=500, detail="Failed to initialize sandbox")
    return detail


@router.get("/sandboxes/{sandbox_id}", response_model=ArenaSandboxDetail)
def get_sandbox(sandbox_id: int, db: Session = Depends(get_db)):
    """Get complete sandbox detail including live positions and execution history."""
    detail = arena_service.get_sandbox_detail(db, sandbox_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    return detail


@router.put("/sandboxes/{sandbox_id}", response_model=ArenaSandboxDetail)
def update_sandbox(sandbox_id: int, data: ArenaSandboxUpdate, db: Session = Depends(get_db)):
    """Update sandbox parameters (name, auto_execute, horizon)."""
    sb = arena_service.update_sandbox(db, sandbox_id, data)
    if not sb:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    return arena_service.get_sandbox_detail(db, sandbox_id)


@router.post("/sandboxes/{sandbox_id}/capital", response_model=ArenaSandboxDetail)
def adjust_capital(sandbox_id: int, data: ArenaCapitalAdjust, db: Session = Depends(get_db)):
    """Top up or withdraw virtual paper capital."""
    try:
        arena_service.adjust_capital(db, sandbox_id, data.amount)
        return arena_service.get_sandbox_detail(db, sandbox_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/sandboxes/{sandbox_id}/orders", response_model=ArenaPositionOut)
def buy_order(sandbox_id: int, order: ArenaOrderCreate, db: Session = Depends(get_db)):
    """Place a simulated paper buy order in the sandbox."""
    try:
        pos = arena_service.buy_stock(db, sandbox_id, order)
        detail = arena_service.get_sandbox_detail(db, sandbox_id)
        # Find the updated position out
        for p in (detail.positions if detail else []):
            if p.id == pos.id:
                return p
        raise HTTPException(status_code=500, detail="Failed to retrieve order state")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/sandboxes/{sandbox_id}/positions/{position_id}/sell", response_model=ArenaTradeOut)
def sell_position(sandbox_id: int, position_id: int, db: Session = Depends(get_db)):
    """Manually sell an active paper position at live market CMP."""
    try:
        trade = arena_service.sell_position(db, sandbox_id, position_id, trade_type="SELL_MANUAL")
        return ArenaTradeOut(
            id=trade.id,
            sandbox_id=trade.sandbox_id,
            symbol=trade.symbol,
            trade_type=trade.trade_type,
            quantity=trade.quantity,
            price=trade.price,
            total_amount=trade.quantity * trade.price,
            realized_pnl=trade.realized_pnl,
            realized_pnl_pct=trade.realized_pnl_pct,
            notes=trade.notes,
            executed_at=trade.executed_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/sandboxes/{sandbox_id}/import-ai", response_model=ArenaSandboxDetail)
def import_ai_picks(sandbox_id: int, data: ArenaImportAIPicks, db: Session = Depends(get_db)):
    """1-Click import top AI Institutional Conviction setups with horizon targets & stops."""
    try:
        arena_service.import_ai_picks_into_sandbox(
            db=db,
            sandbox_id=sandbox_id,
            horizon=data.horizon,
            min_score=data.min_score,
            allocation_pct=data.allocation_pct_per_stock,
            max_stocks=data.max_stocks,
        )
        return arena_service.get_sandbox_detail(db, sandbox_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/sandboxes/{sandbox_id}/reset", response_model=ArenaSandboxDetail)
def reset_sandbox(sandbox_id: int, db: Session = Depends(get_db)):
    """Reset sandbox to starting capital and wipe positions/trades."""
    try:
        arena_service.reset_sandbox(db, sandbox_id)
        return arena_service.get_sandbox_detail(db, sandbox_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.delete("/sandboxes/{sandbox_id}")
def delete_sandbox(sandbox_id: int, db: Session = Depends(get_db)):
    """Delete a sandbox."""
    success = arena_service.delete_sandbox(db, sandbox_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    return {"status": "success", "message": f"Sandbox {sandbox_id} deleted"}


@router.get("/leaderboard", response_model=list[ArenaLeaderboardItem])
def get_leaderboard(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """Rank and compare performance across all sandboxes."""
    return arena_service.get_leaderboard(db, user_id=user_id)


@router.post("/triggers/check")
def check_triggers(db: Session = Depends(get_db)):
    """Trigger real-time check of all target and stop-loss price triggers across sandboxes."""
    triggered = arena_service.check_and_execute_arena_triggers(db)
    return {
        "status": "success",
        "evaluated_at": "now",
        "executed_triggers": triggered,
        "count": len(triggered),
    }


@router.get("/ai-suggestions")
def get_ai_suggestions(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """Returns curated catalog of stocks suggested across AI Intelligence tabs with CMP, Target Buy, and Target Sell."""
    return arena_service.get_ai_suggestions_catalog(db, user_id=user_id)


@router.get("/stock-quote")
def get_stock_quote(symbol: str = Query(...), db: Session = Depends(get_db)):
    """Fetch live CMP and algorithmic suggested target buy & sell for any searched stock."""
    return arena_service.get_stock_quote_with_targets(db, symbol)


@router.patch("/sandboxes/{sandbox_id}/positions/{position_id}", response_model=ArenaSandboxDetail)
def update_position_route(sandbox_id: int, position_id: int, data: ArenaPositionUpdate, db: Session = Depends(get_db)):
    """Update position quantity (with automatic cash adjust) or custom target price."""
    try:
        arena_service.update_position(db, sandbox_id, position_id, data)
        detail = arena_service.get_sandbox_detail(db, sandbox_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Sandbox not found")
        return detail
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/sandboxes/reorder")
def reorder_sandboxes_route(data: ArenaReorderRequest, user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """Save drag and drop reordering of sandboxes."""
    arena_service.reorder_sandboxes(db, user_id=user_id, sandbox_ids=data.sandbox_ids)
    return {"status": "success", "reordered": data.sandbox_ids}


@router.get("/wishlist-stocks")
def get_wishlist_stocks_route(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """Fetch stocks from user's active wishlist with CMP and suggested targets."""
    return arena_service.get_user_wishlist_stocks(db, user_id=user_id)


@router.get("/portfolio-stocks")
def get_portfolio_stocks_route(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    """Fetch stocks from user's live portfolio with CMP and suggested targets."""
    return arena_service.get_user_portfolio_stocks(db, user_id=user_id)


@router.delete("/sandboxes/{sandbox_id}/positions/{position_id}", response_model=ArenaSandboxDetail)
def delete_position(sandbox_id: int, position_id: int, db: Session = Depends(get_db)):
    """Delete a stock throughout from the sandbox, refunding the exact invested amount with 0 P&L booked."""
    try:
        arena_service.delete_position_and_refund(db, sandbox_id, position_id)
        detail = arena_service.get_sandbox_detail(db, sandbox_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Sandbox not found")
        return detail
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


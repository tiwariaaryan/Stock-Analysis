from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, Holding, Transaction, Instrument, MarketPrice
from ..schemas import PortfolioCreate, PortfolioOut, PortfolioDetail, HoldingCreate, HoldingOut
from ..services.market_service import get_or_create_instrument, get_cached_price, resolve_symbol
from ..services.calculations import compute_xirr

router = APIRouter(prefix="/api/v1/portfolios")


@router.get("", response_model=list[PortfolioOut])
def list_portfolios(user_id: int, db: Session = Depends(get_db)):
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).order_by(Portfolio.created_at.desc()).all()
    result = []
    for p in portfolios:
        total = sum(h.quantity * h.buy_price for h in p.holdings)
        result.append(PortfolioOut(
            id=p.id, name=p.name, description=p.description,
            currency=p.currency, created_at=p.created_at,
            holdings_count=len(p.holdings), total_invested=total,
        ))
    return result


@router.post("", response_model=PortfolioOut)
def create_portfolio(data: PortfolioCreate, user_id: int, db: Session = Depends(get_db)):
    p = Portfolio(
        user_id=user_id, name=data.name,
        description=data.description, currency=data.currency,
        created_at=datetime.now(UTC),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return PortfolioOut(
        id=p.id, name=p.name, description=p.description,
        currency=p.currency, created_at=p.created_at,
        holdings_count=0, total_invested=Decimal("0"),
    )


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
def get_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")

    holdings_out = []
    total_invested = Decimal("0")
    total_current = Decimal("0")
    has_current = False

    for h in p.holdings:
        invested = h.quantity * h.buy_price
        total_invested += invested

        cmp = get_cached_price(db, h.symbol)
        current_price = None
        current_value = None
        pnl = None
        pnl_pct = None

        if cmp is not None:
            current_price = cmp
            current_value = h.quantity * cmp
            pnl = current_value - invested
            pnl_pct = float(pnl / invested * 100) if invested else 0
            total_current += current_value
            has_current = True

        holdings_out.append(HoldingOut(
            id=h.id, symbol=h.symbol, quantity=h.quantity,
            buy_price=h.buy_price, buy_date=h.buy_date,
            asset_type=h.asset_type, current_price=current_price,
            current_value=current_value, invested_value=invested,
            pnl=pnl, pnl_pct=pnl_pct,
        ))

    total_pnl = (total_current - total_invested) if has_current else None
    total_pnl_pct = float(total_pnl / total_invested * 100) if total_pnl and total_invested else None

    return PortfolioDetail(
        id=p.id, name=p.name, description=p.description,
        currency=p.currency, created_at=p.created_at, holdings=holdings_out,
        total_invested=total_invested,
        total_current=total_current if has_current else None,
        total_pnl=total_pnl, total_pnl_pct=total_pnl_pct,
    )


@router.post("/{portfolio_id}/holdings", response_model=HoldingOut)
def add_holding(portfolio_id: int, data: HoldingCreate, db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")

    sym = resolve_symbol(data.symbol)
    inst = get_or_create_instrument(db, sym, asset_type=data.asset_type)

    h = Holding(
        portfolio_id=portfolio_id, instrument_id=inst.id, symbol=sym,
        quantity=data.quantity, buy_price=data.buy_price,
        buy_date=data.buy_date or datetime.now(UTC), asset_type=data.asset_type,
    )
    db.add(h)

    tx = Transaction(
        portfolio_id=portfolio_id, instrument_id=inst.id, symbol=sym,
        transaction_type="BUY", quantity=data.quantity, price=data.buy_price,
        fees=Decimal("0"), total_amount=data.quantity * data.buy_price,
        trade_date=data.buy_date or datetime.now(UTC),
        notes="Initial holding purchase", created_at=datetime.now(UTC),
    )
    db.add(tx)
    db.commit()
    db.refresh(h)

    return HoldingOut(
        id=h.id, symbol=h.symbol, quantity=h.quantity,
        buy_price=h.buy_price, buy_date=h.buy_date,
        asset_type=h.asset_type, invested_value=h.quantity * h.buy_price,
    )


@router.delete("/{portfolio_id}/holdings/{holding_id}")
def remove_holding(portfolio_id: int, holding_id: int, db: Session = Depends(get_db)):
    h = db.query(Holding).filter(Holding.id == holding_id, Holding.portfolio_id == portfolio_id).first()
    if not h:
        raise HTTPException(404, "Holding not found")
    db.delete(h)
    db.commit()
    return {"status": "deleted"}


@router.delete("/{portfolio_id}")
def delete_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    db.delete(p)
    db.commit()
    return {"status": "deleted"}


@router.get("/{portfolio_id}/analytics")
def portfolio_analytics(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")

    if not p.holdings:
        return {"xirr_pct": None, "concentration_warnings": [], "sector_distribution": {}, "holdings_analysis": []}

    cash_flows = []
    holdings_analysis = []
    total_current = Decimal("0")
    total_invested = Decimal("0")
    sector_values: dict[str, float] = {}
    warnings = []

    for h in p.holdings:
        invested = float(h.quantity * h.buy_price)
        total_invested += h.quantity * h.buy_price
        buy_date = h.buy_date or datetime.now(UTC)
        cash_flows.append((buy_date, -invested))

        cmp = get_cached_price(db, h.symbol)
        current_val = float(h.quantity * cmp) if cmp else 0
        total_current += Decimal(str(current_val))

        inst = db.query(Instrument).filter(Instrument.symbol == h.symbol).first()
        sector = inst.sector if inst and inst.sector else "Other"
        sector_values[sector] = sector_values.get(sector, 0) + current_val

        holdings_analysis.append({
            "symbol": h.symbol, "invested": invested, "current": current_val,
            "weight_pct": 0, "sector": sector,
        })

    total_cur_float = float(total_current) or 1
    cash_flows.append((datetime.now(UTC), total_cur_float))

    xirr_pct = compute_xirr(cash_flows)

    for ha in holdings_analysis:
        ha["weight_pct"] = round(ha["current"] / total_cur_float * 100, 2)
        if ha["weight_pct"] > 15:
            warnings.append(f"⚠ {ha['symbol']} is {ha['weight_pct']}% of portfolio (>15% concentration risk)")

    for sector, val in sector_values.items():
        pct = round(val / total_cur_float * 100, 2)
        if pct > 30:
            warnings.append(f"⚠ {sector} sector is {pct}% of portfolio (>30% sector concentration)")

    sector_dist = {k: round(v / total_cur_float * 100, 2) for k, v in sorted(sector_values.items(), key=lambda x: -x[1])}

    return {
        "xirr_pct": xirr_pct,
        "total_invested": float(total_invested),
        "total_current": total_cur_float,
        "absolute_return_pct": round((total_cur_float - float(total_invested)) / float(total_invested) * 100, 2) if total_invested else 0,
        "concentration_warnings": warnings,
        "sector_distribution": sector_dist,
        "holdings_analysis": sorted(holdings_analysis, key=lambda x: -x["weight_pct"]),
    }

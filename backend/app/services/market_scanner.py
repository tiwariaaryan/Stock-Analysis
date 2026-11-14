from decimal import Decimal
from sqlalchemy.orm import Session

from ..models import Instrument, MarketPrice


def get_drawdown_scanner(db: Session) -> list[dict]:
    """Calculate 52W drawdown for all instruments with cached prices."""
    instruments = db.query(Instrument).filter(Instrument.is_active == True).all()
    results = []

    for inst in instruments:
        mp = db.query(MarketPrice).filter(
            MarketPrice.instrument_id == inst.id,
        ).order_by(MarketPrice.fetched_at.desc()).first()

        if not mp or not mp.price or not mp.week_52_high:
            continue

        price = float(mp.price)
        high_52w = float(mp.week_52_high)
        low_52w = float(mp.week_52_low) if mp.week_52_low else None

        if high_52w <= 0:
            continue

        drawdown_pct = round((price - high_52w) / high_52w * 100, 2)

        results.append({
            "symbol": inst.symbol,
            "name": inst.name or inst.symbol,
            "sector": inst.sector or "N/A",
            "current_price": price,
            "week_52_high": high_52w,
            "week_52_low": low_52w,
            "drawdown_pct": drawdown_pct,
            "change_pct": float(mp.change_pct) if mp.change_pct else 0.0,
            "volume": mp.volume,
            "market_cap": mp.market_cap,
        })

    results.sort(key=lambda x: x["drawdown_pct"])
    return results


def get_market_movers(db: Session) -> dict:
    """Get top gainers, losers, and volume shockers from cached data."""
    instruments = db.query(Instrument).filter(Instrument.is_active == True).all()
    all_stocks = []

    for inst in instruments:
        mp = db.query(MarketPrice).filter(
            MarketPrice.instrument_id == inst.id,
        ).order_by(MarketPrice.fetched_at.desc()).first()

        if not mp or not mp.price:
            continue

        all_stocks.append({
            "symbol": inst.symbol,
            "name": inst.name or inst.symbol,
            "sector": inst.sector or "N/A",
            "price": float(mp.price),
            "change_pct": float(mp.change_pct) if mp.change_pct else 0.0,
            "change": float(mp.change) if mp.change else 0.0,
            "volume": mp.volume or 0,
            "market_cap": mp.market_cap,
        })

    gainers = sorted(all_stocks, key=lambda x: x["change_pct"], reverse=True)[:10]
    losers = sorted(all_stocks, key=lambda x: x["change_pct"])[:10]
    volume_shockers = sorted(all_stocks, key=lambda x: x["volume"], reverse=True)[:10]

    return {
        "gainers": gainers,
        "losers": losers,
        "volume_shockers": volume_shockers,
    }


def get_sector_heatmap(db: Session) -> dict:
    """Build hierarchical sector → stocks structure for treemap visualization."""
    instruments = db.query(Instrument).filter(Instrument.is_active == True).all()
    sectors: dict[str, list[dict]] = {}

    for inst in instruments:
        mp = db.query(MarketPrice).filter(
            MarketPrice.instrument_id == inst.id,
        ).order_by(MarketPrice.fetched_at.desc()).first()

        if not mp or not mp.price:
            continue

        sector = inst.sector or "Other"
        stock_data = {
            "symbol": inst.symbol,
            "name": inst.name or inst.symbol,
            "price": float(mp.price),
            "change_pct": float(mp.change_pct) if mp.change_pct else 0.0,
            "market_cap": mp.market_cap or 0,
        }

        if sector not in sectors:
            sectors[sector] = []
        sectors[sector].append(stock_data)

    result = []
    for sector_name, stocks in sorted(sectors.items()):
        total_cap = sum(s["market_cap"] for s in stocks)
        stocks.sort(key=lambda x: x["market_cap"], reverse=True)
        result.append({
            "name": sector_name,
            "total_cap": total_cap,
            "stocks": stocks,
        })

    result.sort(key=lambda x: x["total_cap"], reverse=True)
    return {"sectors": result}

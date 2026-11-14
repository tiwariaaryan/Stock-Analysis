"""Fix missing prices: rename bad symbols + try all sources."""
import asyncio, os, sys, re
sys.path.insert(0, os.path.dirname(__file__))

from datetime import UTC, datetime
from decimal import Decimal
import httpx


async def scrape_google(symbol: str) -> float | None:
    clean = symbol.replace(" ", "")
    for exch in ["NSE", "BOM"]:
        url = f"https://www.google.com/finance/quote/{clean}:{exch}"
        try:
            async with httpx.AsyncClient(
                timeout=12, follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
            ) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    print(f"  Google {exch}: HTTP {resp.status_code}")
                    continue
                text = resp.text
                for pattern in [
                    r'data-last-price="([0-9,.]+)"',
                    r'class="YMlKec fxKbKc"[^>]*>[\s₹]*([0-9,]+\.?[0-9]*)',
                    r'"price":\s*"?([0-9,.]+)"?',
                    r'>₹([0-9,]+\.[0-9]+)<',
                ]:
                    m = re.search(pattern, text)
                    if m:
                        price = float(m.group(1).replace(",", ""))
                        if price > 0:
                            print(f"  Google {exch}: ₹{price}")
                            return price
                print(f"  Google {exch}: page loaded but no price pattern matched")
                # Save HTML for debugging
                with open(f"/tmp/google_{clean}_{exch}.html", "w") as f:
                    f.write(text[:5000])
                print(f"  Saved first 5000 chars to /tmp/google_{clean}_{exch}.html")
        except Exception as e:
            print(f"  Google {exch}: {str(e)[:80]}")
    return None


async def try_yfinance(symbol: str) -> float | None:
    import yfinance as yf
    clean = symbol.replace(" ", "")
    for suffix in [".NS", ".BO"]:
        try:
            t = yf.Ticker(f"{clean}{suffix}")
            fi = t.fast_info
            if fi.last_price and fi.last_price > 0:
                print(f"  yfinance {clean}{suffix}: ₹{fi.last_price}")
                return float(fi.last_price)
        except Exception as e:
            print(f"  yfinance {clean}{suffix}: {str(e)[:60]}")
    return None


async def main():
    from app.database import SessionLocal
    from app.models import Instrument, MarketPrice

    db = SessionLocal()

    # Fix symbol with spaces
    bad = db.query(Instrument).filter(Instrument.symbol == "TATA POWER").first()
    if bad:
        existing = db.query(Instrument).filter(Instrument.symbol == "TATAPOWER").first()
        if existing:
            print("TATAPOWER already exists, merging...")
        else:
            bad.symbol = "TATAPOWER"
            bad.name = "Tata Power Company"
            db.commit()
            print("Renamed 'TATA POWER' → 'TATAPOWER'")

    # Find all missing
    instruments = db.query(Instrument).all()
    missing = []
    for inst in instruments:
        mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).first()
        if not mp or not mp.price:
            missing.append(inst)

    if not missing:
        print("\nAll stocks have prices!")
        db.close()
        return

    print(f"\nMissing prices: {[i.symbol for i in missing]}\n")

    for inst in missing:
        sym = inst.symbol
        print(f"--- {sym} ---")

        price = await try_yfinance(sym)
        if not price:
            price = await scrape_google(sym)

        if price:
            now = datetime.now(UTC)
            mp = db.query(MarketPrice).filter(MarketPrice.instrument_id == inst.id).first()
            if mp:
                mp.price = Decimal(str(round(price, 4)))
                mp.fetched_at = now
            else:
                db.add(MarketPrice(
                    instrument_id=inst.id, price=Decimal(str(round(price, 4))),
                    currency="INR", as_of=now, fetched_at=now,
                    source="google_finance", data_kind="EOD", freshness="SCRAPED",
                ))
            db.commit()
            print(f"  SAVED ₹{price}\n")
        else:
            print(f"  ALL SOURCES FAILED\n")

    db.close()

asyncio.run(main())

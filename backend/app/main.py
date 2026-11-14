import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import system, market, portfolios, watchlists, chat, profiles, strategy


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_background_refresh_loop())
    yield
    task.cancel()


app = FastAPI(title="India Investment Intelligence", version="0.4.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(profiles.router)
app.include_router(market.router)
app.include_router(portfolios.router)
app.include_router(watchlists.router)
app.include_router(chat.router)
app.include_router(strategy.router)


async def _background_refresh_loop():
    from .database import SessionLocal
    from .services.market_service import refresh_all_prices

    settings = get_settings()
    interval = settings.market_data_max_age_minutes * 60
    await asyncio.sleep(10)
    while True:
        try:
            db = SessionLocal()
            try:
                await refresh_all_prices(db)
                print(f"[auto-refresh] Prices refreshed at {datetime.now(UTC).isoformat()}")
            finally:
                db.close()
        except Exception as e:
            print(f"[auto-refresh] Error: {e}")
        await asyncio.sleep(interval)

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import system, market, portfolios, watchlists, chat, profiles, strategy, notifications, arena


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables (including new arena tables) are created
    Base.metadata.create_all(bind=engine)
    refresh_task = asyncio.create_task(_background_refresh_loop())
    schedule_task = asyncio.create_task(_scheduled_notifications_loop())
    crawler_task = asyncio.create_task(_background_crawler_loop())
    yield
    refresh_task.cancel()
    schedule_task.cancel()
    crawler_task.cancel()


app = FastAPI(title="India Investment Intelligence", version="0.5.0", lifespan=lifespan)
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
app.include_router(notifications.router)
app.include_router(arena.router)


async def _background_refresh_loop():
    """Refresh prices on boot and periodically, plus load morning news RSS feed."""
    from .database import SessionLocal
    from .services.market_service import refresh_all_prices
    from .services.email_service import check_and_send_notifications
    from .providers.search_orchestrator import get_daily_market_context
    from .services.arena_service import check_and_execute_arena_triggers

    settings = get_settings()
    interval = settings.market_data_max_age_minutes * 60
    await asyncio.sleep(5)

    # Initial boot load: free news and regulatory circulars
    try:
        print("[startup] Ingesting free Google News RSS & regulatory feeds...")
        get_daily_market_context()
        print("[startup] Free market news & sentiment ready.")
    except Exception as e:
        print(f"[startup] News ingestion error: {e}")

    while True:
        try:
            db = SessionLocal()
            try:
                await refresh_all_prices(db)
                print(f"[auto-refresh] Prices refreshed at {datetime.now(UTC).isoformat()}")
                # Auto-evaluate Arena paper trading target / stop-loss triggers
                try:
                    check_and_execute_arena_triggers(db)
                except Exception as e:
                    print(f"[arena-auto-pilot] Trigger evaluation error: {e}")
                # Auto-check notifications after each refresh
                if settings.gmail_address and settings.gmail_app_password:
                    try:
                        check_and_send_notifications(db, user_id=1)
                    except Exception as e:
                        print(f"[notifications] Error: {e}")
            finally:
                db.close()
        except Exception as e:
            print(f"[auto-refresh] Error: {e}")
        await asyncio.sleep(interval)


async def _scheduled_notifications_loop():
    """Send scheduled notifications: morning brief (9:15 AM IST), weekly report (Saturday 8 AM IST)."""
    from .database import SessionLocal
    from .services.email_service import send_morning_brief, send_weekly_report

    settings = get_settings()
    if not settings.gmail_address or not settings.gmail_app_password:
        return

    last_morning_date = None
    last_weekly_date = None

    await asyncio.sleep(30)
    while True:
        try:
            # IST = UTC + 5:30
            import zoneinfo
            try:
                ist = zoneinfo.ZoneInfo("Asia/Kolkata")
            except Exception:
                ist = None

            if ist:
                now_ist = datetime.now(ist)
            else:
                now_ist = datetime.now(UTC).replace(hour=(datetime.now(UTC).hour + 5) % 24)

            today = now_ist.date()
            hour = now_ist.hour
            minute = now_ist.minute
            weekday = now_ist.weekday()  # 0=Monday, 5=Saturday

            # Morning brief: 9:15 AM IST, Monday-Friday
            if weekday < 5 and hour == 9 and 15 <= minute <= 25 and last_morning_date != today:
                db = SessionLocal()
                try:
                    send_morning_brief(db, user_id=1)
                    print(f"[schedule] Morning brief sent at {now_ist.isoformat()}")
                    last_morning_date = today
                finally:
                    db.close()

            # Weekly report: Saturday 8:00 AM IST
            if weekday == 5 and hour == 8 and 0 <= minute <= 10 and last_weekly_date != today:
                db = SessionLocal()
                try:
                    send_weekly_report(db, user_id=1)
                    print(f"[schedule] Weekly report sent at {now_ist.isoformat()}")
                    last_weekly_date = today
                finally:
                    db.close()

        except Exception as e:
            print(f"[schedule] Error: {e}")

        await asyncio.sleep(60)  # Check every minute


async def _background_crawler_loop():
    """Background Crawl4AI worker: scheduled scan for company filings and disclosures."""
    from .services.background_crawler_service import run_scheduled_background_crawl
    await asyncio.sleep(45)  # Let server start and warm up
    while True:
        try:
            print("[crawler] Starting scheduled background corporate disclosure crawl...")
            stats = await run_scheduled_background_crawl()
            print(f"[crawler] Background crawl completed: {stats}")
        except Exception as e:
            print(f"[crawler] Background crawl error: {e}")
        # Run every 6 hours
        await asyncio.sleep(6 * 3600)


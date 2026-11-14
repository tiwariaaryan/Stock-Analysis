# India Investment Intelligence (local-first)

Personal, research-only platform for Indian equities, ETFs, and mutual funds. It intentionally has **no broker order APIs or automated trading**.

## What is runnable now

- FastAPI health endpoint: `GET /health`
- Quote endpoint: `GET /api/v1/quotes/{symbol}`
- Market quote provenance, `as_of`, `fetched_at`, and an explicit freshness label
- `yfinance` best-effort **EOD** fallback only—never presented as live data
- PostgreSQL/TimescaleDB, Redis, API, and Next.js containers
- Initial models/migration for instruments and market prices
- Gemini client and LangGraph scaffolding with a strict tool allowlist (no arbitrary SQL, URLs, OS commands, broker, or trade tools)
- Deterministic financial calculation service and tests
- Empty FYERS OAuth/streaming adapter scaffold, deliberately inactive without credentials
- AMFI adapter boundary reserved for official mutual-fund NAV ingestion

## Run locally

```sh
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000` and `http://localhost:8000/docs`. To run backend tests outside Docker:

```sh
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

Apply the initial migration with `cd backend && alembic upgrade head` (set `DATABASE_URL` / `sqlalchemy.url` appropriately for PostgreSQL in production). Timescale hypertables should be added only after validating query volume and retention needs.

## Data truthfulness

The API never fabricates a current quote. `LIVE` requires an authenticated real-time source (future FYERS connection); `EOD` is a prior end-of-day close; `NAV` is an official mutual-fund net asset value; `UNAVAILABLE` means exactly that. Every response includes source and timestamps.

## Next vertical-slice work

1. Implement schema-validated CSV/XLSX portfolio import with local encrypted-at-rest credentials where applicable.
2. Add official AMFI NAV downloader and tests using recorded fixtures.
3. Complete FYERS OAuth callback/token storage and streaming consumer only after the user supplies an account/credentials.
4. Add background ingestion, portfolio lots, returns/risk services, and dashboard views.

## Security

Do not commit `.env`, API keys, OAuth tokens, or portfolio exports. Gemini has access only to explicit, validated research functions; financial arithmetic stays in Python.

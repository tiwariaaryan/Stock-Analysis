#!/bin/bash
# Convenient local development runner with hot-reload for backend and frontend

# Automatically resolve the root directory whether executed from root or backend/
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$DIR")" == "backend" ]]; then
  ROOT_DIR="$(cd "$DIR/.." && pwd)"
else
  ROOT_DIR="$DIR"
fi
cd "$ROOT_DIR"

echo "🚀 Starting Dalal Street Intelligence Platform in Development Mode..."
echo "📂 Working directory: $ROOT_DIR"

# 1. Clean up any stale processes on ports 8000 and 3000
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 2. Start Backend with explicit auto-reload
echo "📦 Starting FastAPI backend on http://127.0.0.1:8000 with auto-reload..."
cd "$ROOT_DIR/backend"
source venv/bin/activate 2>/dev/null || source .venv/bin/activate 2>/dev/null || true
uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 3. Start Frontend with hot-reload
echo "💻 Starting Next.js frontend on http://localhost:3000 with hot-reload..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

cd "$ROOT_DIR"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

echo ""
echo "✨ Both Frontend & Backend are running with live hot-reloading!"
echo "   - Backend API: http://127.0.0.1:8000 (auto-reloads on python edits)"
echo "   - Frontend Web: http://localhost:3000 (auto-reloads on tsx/css edits)"
echo ""
echo "Press Ctrl+C to stop both servers."
wait

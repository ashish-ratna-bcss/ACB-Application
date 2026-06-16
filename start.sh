#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$ROOT/backend/venv/bin/activate"

QDRANT_LOG="/tmp/qdrant.log"
BACKEND_LOG="/tmp/backend.log"
FRONTEND_LOG="/tmp/frontend.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[START]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail() { echo -e "${RED}[FAIL]${NC}  $1"; }

kill_existing() {
    pkill -f "$BACKEND/qdrant" 2>/dev/null && warn "Killed existing Qdrant" || true
    pkill -f "uvicorn.*app.main" 2>/dev/null && warn "Killed existing backend" || true
    pkill -f "python main.py" 2>/dev/null && true
    # Leave Next.js alone if already running
}

wait_for_port() {
    local port=$1 name=$2 tries=0
    while ! curl -sf "http://localhost:$port" > /dev/null 2>&1; do
        tries=$((tries + 1))
        if [ $tries -ge 30 ]; then
            fail "$name did not start on port $port (30s timeout)"
            fail "Check log: $([ $port -eq 6333 ] && echo $QDRANT_LOG || [ $port -eq 8000 ] && echo $BACKEND_LOG || echo $FRONTEND_LOG)"
            exit 1
        fi
        sleep 1
    done
    log "$name up on port $port"
}

# --- Qdrant ---
if curl -sf http://localhost:6333/collections > /dev/null 2>&1; then
    warn "Qdrant already running on 6333"
else
    kill_existing
    log "Starting Qdrant..."
    cd "$BACKEND"
    nohup ./qdrant > "$QDRANT_LOG" 2>&1 &
    QDRANT_PID=$!
    echo $QDRANT_PID > /tmp/qdrant.pid
    wait_for_port 6333 "Qdrant"
fi

# --- Backend ---
if curl -sf http://localhost:8000/ > /dev/null 2>&1; then
    warn "Backend already running on 8000"
else
    log "Starting backend..."
    cd "$BACKEND"
    source "$VENV"
    nohup python main.py > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > /tmp/backend.pid
    wait_for_port 8000 "Backend"
fi

# --- Frontend ---
if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
    warn "Frontend already running on 3000"
else
    log "Starting frontend..."
    cd "$FRONTEND"
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > /tmp/frontend.pid
    wait_for_port 3000 "Frontend"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All services running${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Frontend  → http://localhost:3000"
echo -e "  Backend   → http://localhost:8000"
echo -e "  Qdrant    → http://localhost:6333"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Logs:"
echo "  Qdrant   → $QDRANT_LOG"
echo "  Backend  → $BACKEND_LOG"
echo "  Frontend → $FRONTEND_LOG"

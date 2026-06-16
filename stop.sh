#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${RED}[STOP]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

stop_service() {
    local name=$1 pidfile=$2 pattern=$3

    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            log "$name stopped (PID $pid)"
        else
            warn "$name PID $pid not running"
        fi
        rm -f "$pidfile"
    else
        # Fallback: kill by pattern
        if pkill -f "$pattern" 2>/dev/null; then
            log "$name stopped (by pattern)"
        else
            warn "$name was not running"
        fi
    fi
}

stop_service "Qdrant"   /tmp/qdrant.pid   "$ROOT/backend/qdrant"
stop_service "Backend"  /tmp/backend.pid  "python main.py"
stop_service "Frontend" /tmp/frontend.pid "next dev"

echo ""
echo -e "${RED}All services stopped.${NC}"

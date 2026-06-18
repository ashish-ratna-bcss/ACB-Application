#!/usr/bin/env bash
# Forcefully stop ALL processes started by this codebase:
#   Qdrant (:6333), Backend (:8000), Frontend (:3000)
# Robust against relative cmdlines, multiprocessing children, and missing pidfiles.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[STOP]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

# Kill every process (and its children) listening on a TCP port — SIGKILL.
kill_port() {
    local port=$1 name=$2 pids
    pids="$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)"
    [ -z "$pids" ] && pids="$(fuser "$port/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$')"
    if [ -n "$pids" ]; then
        # kill children first, then the listeners
        for pid in $pids; do
            pkill -9 -P "$pid" 2>/dev/null || true
        done
        kill -9 $pids 2>/dev/null || true
        log "$name killed on :$port (pids: $(echo $pids | tr '\n' ' '))"
        return 0
    fi
    return 1
}

# Pattern sweep for stragglers not bound to a port — anchored to this repo where possible.
kill_pattern() {
    local pattern=$1 name=$2
    if pkill -9 -f "$pattern" 2>/dev/null; then
        log "$name straggler(s) killed (pattern: $pattern)"
    fi
}

# --- Frontend (:3000) ---
kill_port 3000 "Frontend" || warn "Frontend not on :3000"
kill_pattern "next dev" "Frontend"
kill_pattern "next-server" "Frontend"

# --- Backend (:8000) ---
kill_port 8000 "Backend" || warn "Backend not on :8000"
kill_pattern "$ROOT/backend.*main.py" "Backend"
kill_pattern "uvicorn.*app.main" "Backend"
# only this repo's venv python forks — not arbitrary system multiprocessing
kill_pattern "$ROOT/backend/venv/bin/python.*multiprocessing-fork" "Backend"

# --- Qdrant (:6333) ---
kill_port 6333 "Qdrant" || warn "Qdrant not on :6333"
# straggler: qdrant launched as ./qdrant from this repo's backend dir
for pid in $(pgrep -x qdrant 2>/dev/null); do
    if readlink -f "/proc/$pid/cwd" 2>/dev/null | grep -q "$ROOT/backend"; then
        kill -9 "$pid" 2>/dev/null && log "Qdrant straggler killed (pid $pid)"
    fi
done

# --- pidfile cleanup ---
rm -f /tmp/qdrant.pid /tmp/backend.pid /tmp/frontend.pid 2>/dev/null

# --- verify ---
sleep 1
leftover=""
for p in 3000 8000 6333; do
    if ss -ltnH "sport = :$p" 2>/dev/null | grep -q ":$p"; then
        leftover="$leftover $p"
    fi
done

echo ""
if [ -n "$leftover" ]; then
    warn "Ports still in use:$leftover — rerun or check manually"
else
    echo -e "${GREEN}All services stopped.${NC}"
fi

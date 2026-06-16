#!/usr/bin/env bash
# setup.sh — one-shot bootstrap for ACB (any Linux/macOS server)
# Run once after cloning / copying the project to a new machine.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
QDRANT_VERSION="1.13.6"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail() { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# ── 1. Detect OS + arch ──────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS-$ARCH" in
    Linux-x86_64)   QDRANT_ASSET="qdrant-x86_64-unknown-linux-musl.tar.gz" ;;
    Linux-aarch64)  QDRANT_ASSET="qdrant-aarch64-unknown-linux-musl.tar.gz" ;;
    Darwin-arm64)   QDRANT_ASSET="qdrant-aarch64-apple-darwin.tar.gz" ;;
    Darwin-x86_64)  QDRANT_ASSET="qdrant-x86_64-apple-darwin.tar.gz" ;;
    *) fail "Unsupported platform: $OS-$ARCH" ;;
esac

# ── 2. System dependencies ───────────────────────────────────────────────────
log "Checking system dependencies..."

if [[ "$OS" == "Linux" ]]; then
    MISSING_PKGS=()
    for pkg in python3 python3-venv python3-pip poppler-utils curl; do
        if ! dpkg -s "$pkg" &>/dev/null 2>&1 && ! command -v "${pkg%%-*}" &>/dev/null; then
            MISSING_PKGS+=("$pkg")
        fi
    done
    if [[ ${#MISSING_PKGS[@]} -gt 0 ]]; then
        log "Installing system packages: ${MISSING_PKGS[*]}"
        sudo apt-get update -q
        sudo apt-get install -y -q "${MISSING_PKGS[@]}"
    else
        log "System packages OK"
    fi
elif [[ "$OS" == "Darwin" ]]; then
    if ! command -v brew &>/dev/null; then
        fail "Homebrew not found. Install from https://brew.sh first."
    fi
    for pkg in python3 poppler; do
        brew list "$pkg" &>/dev/null || brew install "$pkg"
    done
fi

# ── 3. Python venv ───────────────────────────────────────────────────────────
VENV="$BACKEND/venv"
log "Setting up Python venv at $VENV ..."

if [[ ! -f "$VENV/bin/activate" ]]; then
    python3 -m venv "$VENV"
    log "Venv created"
else
    log "Venv exists — skipping creation"
fi

source "$VENV/bin/activate"

log "Upgrading pip..."
pip install --upgrade pip -q

# ── 4. Python packages ───────────────────────────────────────────────────────
log "Installing Python requirements..."
pip install -r "$BACKEND/requirements.txt"

deactivate
log "Python packages installed"

# ── 5. Qdrant binary ─────────────────────────────────────────────────────────
QDRANT_BIN="$BACKEND/qdrant"

need_qdrant=false
if [[ ! -f "$QDRANT_BIN" ]]; then
    need_qdrant=true
elif [[ "$OS" == "Linux" ]]; then
    # Verify the existing binary matches this machine's arch
    BIN_ARCH="$(file "$QDRANT_BIN" 2>/dev/null)"
    if [[ "$ARCH" == "aarch64" ]] && echo "$BIN_ARCH" | grep -qv "aarch64\|ARM aarch64"; then
        warn "Qdrant binary arch mismatch — re-downloading"
        need_qdrant=true
    elif [[ "$ARCH" == "x86_64" ]] && echo "$BIN_ARCH" | grep -q "aarch64\|ARM"; then
        warn "Qdrant binary arch mismatch — re-downloading"
        need_qdrant=true
    fi
fi

if $need_qdrant; then
    QDRANT_URL="https://github.com/qdrant/qdrant/releases/download/v${QDRANT_VERSION}/${QDRANT_ASSET}"
    QDRANT_TMP="/tmp/qdrant-${QDRANT_VERSION}.tar.gz"

    log "Downloading Qdrant v${QDRANT_VERSION} (${QDRANT_ASSET})..."
    curl -fsSL -o "$QDRANT_TMP" "$QDRANT_URL" || fail "Download failed: $QDRANT_URL"

    log "Extracting..."
    tar -xzf "$QDRANT_TMP" -C "$BACKEND" qdrant
    chmod +x "$QDRANT_BIN"
    rm -f "$QDRANT_TMP"
    log "Qdrant binary ready"
else
    log "Qdrant binary exists and arch matches — skipping download"
fi

# Verify
"$QDRANT_BIN" --version || fail "Qdrant binary broken — delete $QDRANT_BIN and re-run setup"

# ── 6. Qdrant config ─────────────────────────────────────────────────────────
CONFIG="$BACKEND/config/config.yaml"
if [[ ! -f "$CONFIG" ]]; then
    log "Creating default Qdrant config..."
    mkdir -p "$BACKEND/config"
    cat > "$CONFIG" <<'EOF'
storage:
  storage_path: ./storage

service:
  host: 0.0.0.0
  http_port: 6333
  grpc_port: 6334

log_level: INFO

telemetry_disabled: true
EOF
fi

# ── 7. Storage + upload dirs ─────────────────────────────────────────────────
mkdir -p "$BACKEND/storage" "$BACKEND/pdf-files" "$BACKEND/snapshots"
log "Directories ready"

# ── 8. Frontend deps ─────────────────────────────────────────────────────────
FRONTEND="$ROOT/frontend"
if [[ -f "$FRONTEND/package.json" ]]; then
    if ! command -v node &>/dev/null; then
        warn "Node.js not found — skipping frontend install. Install Node 18+ then run: cd frontend && npm install"
    else
        log "Installing frontend npm packages..."
        (cd "$FRONTEND" && npm install --silent)
        log "Frontend packages installed"
    fi
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup complete — run ./start.sh to launch${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Backend venv : $VENV"
echo "  Qdrant       : $QDRANT_BIN  (v$(${QDRANT_BIN} --version | awk '{print $2}'))"
echo "  Config       : $CONFIG"
echo ""

# setup.ps1 — ACB bootstrap for Windows (PowerShell 5.1+ or PowerShell Core 7+)
# Run once after copying the project to a new machine:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup.ps1
#
# Requires: Python 3.10+, Node 18+ (install from python.org / nodejs.org first)

$ErrorActionPreference = "Stop"
$QDRANT_VERSION = "1.13.6"

$ROOT    = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$VENV    = Join-Path $BACKEND "venv"

function log($msg)  { Write-Host "[SETUP] $msg" -ForegroundColor Green }
function warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function fail($msg) { Write-Host "[FAIL]  $msg" -ForegroundColor Red; exit 1 }

# ── 1. Sanity checks ─────────────────────────────────────────────────────────
log "Checking prerequisites..."

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    fail "Python not found. Install Python 3.10+ from https://python.org and re-run."
}
$pyVer = python --version 2>&1
log "Found $pyVer"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    warn "Node.js not found — frontend npm install will be skipped. Install from https://nodejs.org"
    $HAS_NODE = $false
} else {
    $HAS_NODE = $true
    log "Found Node $(node --version)"
}

# ── 2. Python venv ───────────────────────────────────────────────────────────
log "Setting up Python venv at $VENV ..."

if (-not (Test-Path "$VENV\Scripts\activate.bat")) {
    python -m venv $VENV
    log "Venv created"
} else {
    log "Venv exists — skipping creation"
}

$PIP = Join-Path $VENV "Scripts\pip.exe"
$PYTHON = Join-Path $VENV "Scripts\python.exe"

log "Upgrading pip..."
& $PYTHON -m pip install --upgrade pip -q

# ── 3. Python packages ───────────────────────────────────────────────────────
log "Installing Python requirements (this takes a few minutes first time)..."
& $PIP install -r "$BACKEND\requirements.txt"
log "Python packages installed"

# ── 4. Poppler for Windows (needed by pdf2image) ─────────────────────────────
$POPPLER_DIR = Join-Path $BACKEND "poppler"
$POPPLER_BIN = Join-Path $POPPLER_DIR "Library\bin"

if (-not (Test-Path $POPPLER_BIN)) {
    log "Downloading Poppler for Windows..."
    $POPPLER_VERSION = "24.08.0"
    $POPPLER_URL = "https://github.com/oschwartz10612/poppler-windows/releases/download/v${POPPLER_VERSION}-0/Release-${POPPLER_VERSION}-0.zip"
    $POPPLER_ZIP = Join-Path $env:TEMP "poppler-windows.zip"

    try {
        Invoke-WebRequest -Uri $POPPLER_URL -OutFile $POPPLER_ZIP -UseBasicParsing
        Expand-Archive -Path $POPPLER_ZIP -DestinationPath $BACKEND -Force
        # Rename extracted folder to "poppler"
        $extracted = Get-ChildItem $BACKEND -Directory | Where-Object { $_.Name -like "Release-*" } | Select-Object -First 1
        if ($extracted) { Rename-Item $extracted.FullName $POPPLER_DIR }
        Remove-Item $POPPLER_ZIP -Force
        log "Poppler installed at $POPPLER_BIN"
    } catch {
        warn "Poppler download failed. PDF processing won't work."
        warn "Manual install: https://github.com/oschwartz10612/poppler-windows/releases"
    }
} else {
    log "Poppler exists — skipping"
}

# ── 5. Patch config.py POPPLER_PATH for Windows ──────────────────────────────
$CONFIG_PY = Join-Path $BACKEND "app\config.py"
if (Test-Path $CONFIG_PY) {
    $content = Get-Content $CONFIG_PY -Raw
    $escaped = $POPPLER_BIN -replace "\\", "\\\\"
    if ($content -notmatch [regex]::Escape($POPPLER_BIN)) {
        $content = $content -replace `
            'POPPLER_PATH\s*=\s*os\.getenv\("POPPLER_PATH".*?\)', `
            "POPPLER_PATH = os.getenv(`"POPPLER_PATH`", r`"$($POPPLER_BIN)`" if os.name == `"nt`" else `"`")"
        Set-Content $CONFIG_PY $content -NoNewline
        log "Updated POPPLER_PATH in config.py"
    }
}

# ── 6. Qdrant binary ─────────────────────────────────────────────────────────
$QDRANT_EXE = Join-Path $BACKEND "qdrant.exe"

if (-not (Test-Path $QDRANT_EXE)) {
    log "Downloading Qdrant v$QDRANT_VERSION for Windows..."
    $QDRANT_ASSET = "qdrant-x86_64-pc-windows-msvc.zip"
    $QDRANT_URL   = "https://github.com/qdrant/qdrant/releases/download/v${QDRANT_VERSION}/${QDRANT_ASSET}"
    $QDRANT_ZIP   = Join-Path $env:TEMP "qdrant-windows.zip"

    try {
        Invoke-WebRequest -Uri $QDRANT_URL -OutFile $QDRANT_ZIP -UseBasicParsing
        Expand-Archive -Path $QDRANT_ZIP -DestinationPath $BACKEND -Force
        Remove-Item $QDRANT_ZIP -Force
        log "Qdrant ready at $QDRANT_EXE"
    } catch {
        fail "Qdrant download failed: $_"
    }
} else {
    $ver = & $QDRANT_EXE --version 2>&1
    log "Qdrant exists: $ver"
}

# ── 7. Qdrant config ─────────────────────────────────────────────────────────
$CONFIG_YAML = Join-Path $BACKEND "config\config.yaml"
if (-not (Test-Path $CONFIG_YAML)) {
    log "Creating Qdrant config..."
    New-Item -ItemType Directory -Path (Join-Path $BACKEND "config") -Force | Out-Null
    @"
storage:
  storage_path: ./storage

service:
  host: 0.0.0.0
  http_port: 6333
  grpc_port: 6334

log_level: INFO

telemetry_disabled: true
"@ | Set-Content $CONFIG_YAML
}

# ── 8. Storage + upload dirs ─────────────────────────────────────────────────
foreach ($d in @("storage", "pdf-files", "snapshots")) {
    New-Item -ItemType Directory -Path (Join-Path $BACKEND $d) -Force | Out-Null
}
log "Directories ready"

# ── 9. Frontend npm ───────────────────────────────────────────────────────────
$FRONTEND = Join-Path $ROOT "frontend"
if ($HAS_NODE -and (Test-Path "$FRONTEND\package.json")) {
    log "Installing frontend npm packages..."
    Push-Location $FRONTEND
    npm install --silent
    Pop-Location
    log "Frontend packages installed"
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup complete — run .\start.bat to launch" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend venv : $VENV"
Write-Host "  Qdrant       : $QDRANT_EXE"
Write-Host "  Poppler      : $POPPLER_BIN"
Write-Host ""

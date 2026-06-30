#!/bin/bash

# Ensure we operate in the directory where backend.sh is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================="
echo " Stopping existing backend services...    "
echo "=========================================="

# Find and terminate existing main.py or uvicorn processes
API_PIDS=$(pgrep -f "python main.py" || true)
if [ -n "$API_PIDS" ]; then
    echo "Stopping existing API processes: $API_PIDS"
    kill $API_PIDS 2>/dev/null || kill -9 $API_PIDS 2>/dev/null
fi

# Find and terminate existing qdrant processes
QDRANT_PIDS=$(pgrep -f "qdrant --config-path" || true)
if [ -n "$QDRANT_PIDS" ]; then
    echo "Stopping existing Qdrant processes: $QDRANT_PIDS"
    kill $QDRANT_PIDS 2>/dev/null || kill -9 $QDRANT_PIDS 2>/dev/null
fi

sleep 1

# Setup trap to stop Qdrant when this script is interrupted or terminated
cleanup() {
    echo ""
    echo "=========================================="
    echo " Shutting down Qdrant...                 "
    echo "=========================================="
    QPID=$(pgrep -f "qdrant --config-path" || true)
    if [ -n "$QPID" ]; then
        kill $QPID 2>/dev/null
    fi
    exit 0
}
trap cleanup INT TERM EXIT

echo "=========================================="
echo " Starting Qdrant vector database...      "
echo "=========================================="
chmod +x ./qdrant
nohup ./qdrant --config-path config/config.yaml > qdrant.log 2>&1 &

# Wait for Qdrant to be ready
echo -n "Waiting for Qdrant to start"
for i in {1..10}; do
    if curl -s http://localhost:6333/collections >/dev/null; then
        echo " ✓ Active!"
        break
    fi
    echo -n "."
    sleep 1
done

echo "=========================================="
echo " Starting FastAPI app...                  "
echo "=========================================="
./venv/bin/python main.py

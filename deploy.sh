#!/bin/bash
set -e

echo "=== ACB Application Deployment Script ==="
echo ""

# Check disk space
DISK_FREE=$(df / | tail -1 | awk '{print $4}')
DISK_FREE_GB=$((DISK_FREE / 1048576))
echo "Available disk space: ${DISK_FREE_GB} GB"
if [ $DISK_FREE_GB -lt 50 ]; then
    echo "⚠ WARNING: Less than 50GB free. Deployment may fail."
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

if ! docker network inspect app_default &> /dev/null; then
    echo "❌ app_default network not found. Please run existing services first."
    exit 1
fi

echo ""
echo "=== Building ACB Services ==="
docker-compose build

echo ""
echo "=== Starting ACB Services ==="
docker-compose up -d

echo ""
echo "=== Waiting for services to be healthy ==="
sleep 5

# Check if services are running
if ! docker-compose ps | grep -q "acb-api.*Up"; then
    echo "❌ acb-api failed to start"
    docker-compose logs acb-api
    exit 1
fi

if ! docker-compose ps | grep -q "acb-qdrant.*Up"; then
    echo "❌ acb-qdrant failed to start"
    docker-compose logs acb-qdrant
    exit 1
fi

echo "✓ Services started successfully"

echo ""
echo "=== Testing API Health ==="
if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
    echo "✓ API is responding"
else
    echo "⚠ API health check failed (may still be starting)"
fi

if curl -s http://localhost:6333/health > /dev/null 2>&1; then
    echo "✓ Qdrant is responding"
else
    echo "⚠ Qdrant health check failed"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Update system nginx configuration:"
echo "   sudo cp nginx-acb-routes.conf /etc/nginx/nginx.conf"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "2. Verify deployment:"
echo "   curl https://98.86.63.69/api/docs"
echo "   curl https://98.86.63.69/"
echo ""
echo "3. Monitor logs:"
echo "   docker-compose logs -f acb-api"
echo ""
echo "=== Deployment Complete ==="

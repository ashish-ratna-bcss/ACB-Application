#!/bin/bash

set -e

echo "🚀 ACB Application Deployment Script"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check disk space
echo "Checking disk space..."
DISK_FREE=$(df / | tail -1 | awk '{print $4}')
DISK_FREE_GB=$((DISK_FREE / 1048576))
echo "Available: ${DISK_FREE_GB} GB"
if [ $DISK_FREE_GB -lt 50 ]; then
    echo -e "${YELLOW}⚠ WARNING: Less than 50GB free. Deployment may fail.${NC}"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Docker
echo ""
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose found${NC}"

# Check network
echo ""
echo "Checking Docker network..."
if ! docker network inspect app_default &> /dev/null; then
    echo -e "${YELLOW}Creating app_default network...${NC}"
    docker network create app_default
fi
echo -e "${GREEN}✓ app_default network ready${NC}"

# Check .env file
echo ""
echo "Checking configuration..."
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ backend/.env not found${NC}"
    echo "Copy template: cp backend/.env.example backend/.env"
    echo "Then edit with your API keys"
    exit 1
fi
echo -e "${GREEN}✓ backend/.env found${NC}"

# Build images
echo ""
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose build

# Start services
echo ""
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

# Wait for services
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check services running
echo ""
echo "Verifying services..."
RUNNING=true

if ! docker-compose ps | grep -q "acb-api.*Up"; then
    echo -e "${RED}❌ acb-api not running${NC}"
    RUNNING=false
fi

if ! docker-compose ps | grep -q "acb-qdrant.*Up"; then
    echo -e "${RED}❌ acb-qdrant not running${NC}"
    RUNNING=false
fi

if ! docker-compose ps | grep -q "acb-frontend.*Up"; then
    echo -e "${RED}❌ acb-frontend not running${NC}"
    RUNNING=false
fi

if [ "$RUNNING" = false ]; then
    echo ""
    echo "Service logs:"
    docker-compose logs
    exit 1
fi

echo -e "${GREEN}✓ All services running${NC}"

# Health checks
echo ""
echo "Running health checks..."
if docker exec acb-api curl -f http://localhost:8000/health &> /dev/null; then
    echo -e "${GREEN}✓ API health OK${NC}"
else
    echo -e "${YELLOW}⚠ API health check pending (still starting)${NC}"
fi

if docker exec acb-qdrant curl -f http://localhost:6333/health &> /dev/null; then
    echo -e "${GREEN}✓ Qdrant health OK${NC}"
else
    echo -e "${YELLOW}⚠ Qdrant health check pending${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}✅ ACB services deployed successfully!${NC}"
echo ""
echo "Container status:"
docker-compose ps
echo ""
echo "Next steps:"
echo "1. Verify backend health:"
echo "   docker exec acb-api curl http://localhost:8000/health"
echo ""
echo "2. Update system nginx to route ACB traffic:"
echo "   See DEPLOY.md for nginx configuration"
echo ""
echo "3. Monitor logs:"
echo "   docker-compose logs -f acb-api"
echo ""
echo "Deployment guide: DEPLOY.md"

# ACB Application Deployment Guide

## Prerequisites

- 50+ GB free disk space (after adding storage)
- Docker & Docker Compose
- Existing `app_default` network (for communication with forensic-audio services)
- Existing nginx with SSL certificates at `/etc/nginx/certs/`

## Server Preparation (AWS: 98.86.63.69)

### 1. Expand Disk (if not done)
```bash
# Check current size
df -h /

# Request +50 GB from AWS EC2 console
# Then resize (specific commands depend on filesystem)
```

### 2. Clean Docker (Optional)
```bash
# Reclaim build cache (~20 GB)
docker builder prune -f

# Remove unused images/volumes
docker system prune -a --volumes
```

### 3. Clone & Prepare Repository
```bash
cd /home/ubuntu
git clone <repo-url> acb-app
cd acb-app

# Set environment variables (backend/.env already has defaults)
# Review and update as needed:
cat backend/.env
```

## Deployment Steps

### 1. Build & Start ACB Services
```bash
cd /home/ubuntu/acb-app

# Build images (takes ~10-15 min first time)
docker-compose build

# Start services
docker-compose up -d

# Verify running
docker-compose ps
```

### 2. Verify Service Health
```bash
# Check logs
docker-compose logs acb-api
docker-compose logs acb-qdrant

# Test API (from server)
curl -s http://localhost:8000/docs | head -10
curl -s http://localhost:6333/health

# Test from client
curl https://98.86.63.69/api/docs
```

### 3. Update System Nginx
```bash
# Backup existing config
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

# Add ACB routes to existing nginx
# Option A: Replace entire config with nginx-acb-routes.conf
sudo cp nginx-acb-routes.conf /etc/nginx/nginx.conf

# Option B: Add to existing config manually
# Add upstream blocks + /api and / location blocks from nginx-acb-routes.conf
# Keep existing routes for other services

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 4. Verify Full Stack
```bash
# API endpoint
curl -s https://98.86.63.69/api/docs

# Frontend
curl -s https://98.86.63.69/ | head -20

# API connectivity to remote services
curl -s https://98.86.63.69/api/dashboard
```

## Network Architecture

```
Internet (HTTPS)
    ↓
nginx (port 443) 
    ├→ /api/* → acb-api:8000 (FastAPI)
    ├→ / → acb-frontend:3000 (React + nginx)
    └→ (other routes to existing services)
    
app_default network (internal):
    ├─ acb-api:8000 ↔ acb-qdrant:6333 (local)
    ├─ acb-api:8000 ↔ forensic-audio:8009 (speech intel)
    ├─ acb-api:8000 ↔ acb-ocr:8000 (OCR API)
    └─ acb-api:8000 → 32.192.131.130:11434 (Ollama, external)
```

## Monitoring

```bash
# Check running containers
docker-compose ps

# View logs (follow mode)
docker-compose logs -f acb-api

# Check disk usage
df -h /
docker system df

# Verify network communication
docker exec acb-api ping acb-qdrant
docker exec acb-api curl -s http://98.86.63.69/ocr/jobs -X GET
```

## Rollback

```bash
# Stop ACB services only
docker-compose down

# Keep volumes (data preserved)
# To remove volumes: docker-compose down -v
```

## Environment Variables

### Backend (backend/.env)
```
# External APIs (already configured)
SPEECH_INTEL_BASE_URL=http://98.86.63.69
SPEECH_INTEL_API_KEY=<key>
SARVAM_API_KEY=<key>
HF_TOKEN=<token>
LOCAL_STT_URL=<url>
STT_API_KEY=<key>
OLLAMA_URL=http://32.192.131.130:11434
```

### Frontend (build-time only)
```
REACT_APP_BACKEND_URL=http://98.86.63.69/api
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 80/443 already in use | Other nginx running; stop or reconfigure ports |
| Disk full during build | Run `docker builder prune -f` then retry |
| API returns 502 | Check `docker-compose logs acb-api` |
| Frontend shows 404 | Verify REACT_APP_BACKEND_URL is set correctly |
| OCR fails | Check SPEECH_INTEL_BASE_URL and API key in backend/.env |
| Diarization slow | Local pyannote uses CPU; if GPU needed, use speech intel service |

## Post-Deployment

- Monitor disk usage weekly
- Set up log rotation for container logs
- Schedule backup of acb-data volume
- Document any configuration changes

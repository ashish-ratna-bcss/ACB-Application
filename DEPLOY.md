# ACB Application Deployment Guide

## Prerequisites

- Docker 29.1.3+
- Docker Compose 2.0+
- 108 GB+ free disk space (recommended)
- Server with external IP for HTTPS access

## Server Setup

### 1. Clone Repository

```bash
cd /home/ubuntu
git clone https://github.com/your-org/ACB.git
cd ACB
```

### 2. Prepare Environment

Copy and edit `.env` file with your secrets:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with actual API keys
```

### 3. Create Docker Network (first time only)

```bash
docker network create app_default
```

### 4. Build & Start Containers

```bash
docker-compose up -d
```

Containers started:
- `acb-api` — FastAPI backend on port 8000 (internal)
- `acb-frontend` — React frontend on port 3000 (internal)
- `acb-qdrant` — Qdrant vector DB on port 6333 (internal)

### 5. Integrate with Existing Nginx

Add ACB routes to main nginx config. Edit `/etc/nginx/sites-available/default` or equivalent:

```nginx
upstream acb-api {
    server localhost:8000;
}

upstream acb-frontend {
    server localhost:3000;
}

server {
    listen 443 ssl http2;
    server_name _;

    # ... existing SSL config ...

    client_max_body_size 300m;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    # ACB API routes
    location /api/ {
        proxy_pass http://acb-api/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }

    # ACB Frontend
    location /acb/ {
        proxy_pass http://acb-frontend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ... existing routes for other services ...
}
```

Then reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Environment Variables

**Backend (.env)**:
- `SARVAM_API_KEY` — Admin STT transcription
- `HF_TOKEN` — HuggingFace (pyannote diarization)
- `LOCAL_STT_URL` — Investigation officer STT endpoint
- `STT_API_KEY` — Self-hosted STT key
- `SPEECH_INTEL_BASE_URL` — External speech intelligence service (default: http://98.86.63.69)
- `SPEECH_INTEL_API_KEY` — Speech intel auth key
- `QDRANT_URL` — Vector DB (default: http://acb-qdrant:6333, use acb-qdrant inside Docker)

**Frontend**:
- Built with `REACT_APP_BACKEND_URL` pointing to `/api` (relative, proxied by nginx)

## Verification

```bash
# Check running containers
docker ps

# View logs
docker-compose logs -f acb-api
docker-compose logs -f acb-frontend
docker-compose logs -f acb-qdrant

# Test backend health
curl -k https://your-server/api/health

# Test frontend
curl -k https://your-server/acb/
```

## Disk Space Management

Current usage estimates:
- ACB images: ~7 GB
- Qdrant storage: grows with documents
- Data volumes: grows with uploads

Monitor disk:

```bash
df -h /
docker system df
```

If running low:
```bash
# Clean dangling images/layers (safe)
docker system prune -f

# Clean build cache (safe)
docker builder prune -f
```

## Troubleshooting

**Containers failing to start:**
- Check logs: `docker-compose logs`
- Verify network exists: `docker network ls | grep app_default`
- Verify ports not in use: `sudo ss -tlnp | grep -E '8000|3000|6333'`

**Qdrant connection errors:**
- Verify container is running: `docker ps | grep acb-qdrant`
- Check from backend container: `docker exec acb-api curl http://acb-qdrant:6333/health`

**Frontend not loading:**
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Verify ACB location blocks added to nginx config
- Reload nginx: `sudo systemctl reload nginx`

## Upgrades

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose build

# Restart services
docker-compose up -d
```

## Backup

```bash
# Backup Qdrant data
docker exec acb-qdrant tar czf - /qdrant/storage > qdrant-backup-$(date +%Y%m%d).tar.gz

# Backup database
docker cp acb-api:/app/acb_documents.db ./acb_documents.db.backup
```

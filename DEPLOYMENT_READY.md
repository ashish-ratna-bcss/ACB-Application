# 🚀 ACB Deployment Ready

Codebase is now production-ready for deployment. All necessary configuration files and deployment scripts are in place.

## What Was Updated

### Configuration Files

✓ **backend/main.py** - Updated to disable auto-reload in production mode
✓ **backend/app/config.py** - Updated to use container-aware Qdrant URL
✓ **backend/.env.example** - Created with all required environment variables
✓ **docker-compose.yml** - Updated with proper volumes, healthchecks, environment vars, and dependencies
✓ **backend/.dockerignore** - Already present, optimized build cache
✓ **acb-demo-application/.dockerignore** - Created for frontend builds
✓ **nginx-acb-routes.conf** - Fixed upstream port to match frontend container (port 80)

### Deployment Scripts & Documentation

✓ **deploy.sh** - Production-ready deployment script with health checks
✓ **DEPLOY.md** - Complete deployment guide with step-by-step instructions
✓ **DEPLOYMENT_CHECKLIST.md** - Full checklist for pre/during/post deployment verification

## Files Ready to Commit

```bash
# Modified for deployment
- backend/main.py
- backend/app/config.py
- backend/.env.example
- docker-compose.yml
- deploy.sh
- nginx-acb-routes.conf

# New files for deployment
- DEPLOY.md
- DEPLOYMENT_CHECKLIST.md
- acb-demo-application/.dockerignore
```

## What NOT to Commit

```bash
# These should NOT be committed (already in .gitignore)
- backend/.env (contains real API keys)
- backend/acb_documents.db*
- backend/pdf-files/
- backend/storage/
```

## Deployment Steps

### 1. Commit Changes (Local)

```bash
# Stage deployment files
git add backend/main.py backend/app/config.py backend/.env.example
git add docker-compose.yml deploy.sh nginx-acb-routes.conf
git add DEPLOY.md DEPLOYMENT_CHECKLIST.md DEPLOYMENT_READY.md
git add acb-demo-application/.dockerignore

# Commit
git commit -m "chore: Prepare application for AWS deployment"

# Push to remote
git push origin demo
```

### 2. Deploy on Server

```bash
# SSH into server
ssh -i ~/Downloads/acb_processor.pem ubuntu@98.86.63.69

# Clone/pull latest code
cd /home/ubuntu
git clone <repo-url> ACB  # or: cd ACB && git pull
cd ACB

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your actual API keys

# Run deployment
bash deploy.sh
```

### 3. Configure Nginx (Server)

After containers are running, add ACB routes to system nginx:

```bash
# Update existing nginx config
sudo nano /etc/nginx/sites-available/default

# Add ACB upstream blocks and location blocks
# (See DEPLOY.md for exact configuration)

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Verify Deployment

```bash
# Check all containers running
docker-compose ps

# Test API
docker exec acb-api curl http://localhost:8000/health

# Test via browser
curl -k https://98.86.63.69/api/health
```

## Key Configuration Details

### Environment Variables (backend/.env)

```
SARVAM_API_KEY=...           # Admin transcription
HF_TOKEN=...                  # Hugging Face models
LOCAL_STT_URL=...             # Investigation officer STT
STT_API_KEY=...               # STT authentication
SPEECH_INTEL_BASE_URL=...     # Existing speech service
SPEECH_INTEL_API_KEY=...      # Speech service auth
```

### Docker Network

- Uses existing `app_default` network (created by existing services)
- ACB containers join same network as forensic-audio, acb-ocr
- Services communicate via container DNS names

### Volume Mappings

```yaml
acb-data:         # Main app data (SQLite DB)
acb-pdf:          # PDF uploads
acb-storage:      # Processed files/cache
qdrant-storage:   # Vector database
```

### Healthchecks

- **acb-api**: `curl http://localhost:8000/health` (30s interval)
- **acb-qdrant**: `curl http://localhost:6333/health` (30s interval)
- Both required before dependent containers start

## Disk Space Status

Before deployment:
- Available: 108 GB
- Required for ACB: ~7 GB
- Remaining after: ~101 GB ✓

Safe to deploy with existing resources.

## Troubleshooting Reference

See **DEPLOYMENT_CHECKLIST.md** for detailed troubleshooting guide.

Quick diagnostics:
```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f acb-api

# Check disk
df -h /
docker system df

# Test connectivity between containers
docker exec acb-api curl http://acb-qdrant:6333/health
```

## Next Steps

1. **Commit code** with deployment changes
2. **Review DEPLOY.md** for step-by-step instructions
3. **Use DEPLOYMENT_CHECKLIST.md** during server deployment
4. **Monitor logs** after deployment for any issues

## Support

For issues during deployment:
- Check logs: `docker-compose logs`
- Review troubleshooting in DEPLOYMENT_CHECKLIST.md
- Verify network connectivity between containers
- Ensure .env file is configured with real API keys

---

**Status**: ✅ Ready for production deployment
**Date Prepared**: 2026-06-30
**Total Deployment Time**: ~15-20 minutes (on server with 108GB storage)

# ACB Deployment Checklist

## Pre-Deployment (Local)

- [x] Removed PaddleOCR from requirements.txt
- [x] Cleaned up dead PaddleOCR code in app/main.py
- [x] Cleaned up ocr.py (kept remote OCR functions only)
- [x] Updated api.js to use /api prefix for routing
- [x] Created .gitignore for project
- [x] Created backend/Dockerfile
- [x] Created backend/.dockerignore
- [x] Created acb-demo-application/Dockerfile
- [x] Created acb-demo-application/nginx.conf
- [x] Created docker-compose.yml
- [x] Created nginx-acb-routes.conf for system nginx
- [x] Created DEPLOYMENT.md guide
- [x] Created deploy.sh automation script

## Server Preparation (AWS: 98.86.63.69)

### Disk Expansion
- [ ] Verify current disk size: `df -h /`
- [ ] Add 50GB via AWS EC2 console
- [ ] Resize partition (if needed): `sudo growpart /dev/xvda 1 && sudo resize2fs /dev/xvda1`
- [ ] Verify new size: `df -h /`

### Docker Cleanup (Optional)
- [ ] Remove unused images: `docker image prune -a`
- [ ] Clear build cache: `docker builder prune -f`
- [ ] Verify free space: `df -h /` (should be 50+ GB)

### Network Verification
- [ ] Verify app_default network exists: `docker network ls | grep app_default`
- [ ] Verify existing services running: `docker ps | grep -E "forensic|postgres|redis"`

## Deployment

### 1. Prepare Repository
```bash
cd /home/ubuntu
git clone <repo-url> acb-app  # or pull if exists
cd acb-app
chmod +x deploy.sh
```
- [ ] Repository cloned/updated
- [ ] .env file reviewed (backend/.env)

### 2. Run Automated Deployment
```bash
./deploy.sh
```
- [ ] Script completed successfully
- [ ] No errors in build output
- [ ] All 3 containers running: `docker-compose ps`

### 3. Verify Service Health
```bash
# Check containers
docker-compose ps

# Test API
curl -s http://localhost:8000/docs | head -20
curl -s http://localhost:6333/health

# Check logs
docker-compose logs acb-api | tail -20
docker-compose logs acb-qdrant | tail -20
docker-compose logs acb-frontend | tail -20
```
- [ ] acb-api running on port 8000
- [ ] acb-qdrant running on port 6333
- [ ] acb-frontend running and ready
- [ ] No error logs

### 4. Update System Nginx

**BACKUP first:**
```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
```
- [ ] Backup created

**Update config:**
```bash
sudo cp nginx-acb-routes.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```
- [ ] nginx config test passed
- [ ] nginx reloaded successfully

## Post-Deployment Testing

### HTTPS Endpoints
```bash
curl https://98.86.63.69/api/docs
curl https://98.86.63.69/
```
- [ ] API docs accessible
- [ ] Frontend loads

### API Connectivity
```bash
curl -s https://98.86.63.69/api/dashboard
curl -s https://98.86.63.69/api/settings
```
- [ ] API calls succeed
- [ ] No CORS errors in browser console

### Remote Service Integration
```bash
docker exec acb-api curl -s http://98.86.63.69/ocr/jobs -X GET
docker exec acb-api curl -s http://124.123.14.2:8009/health
```
- [ ] OCR API reachable
- [ ] STT endpoint reachable
- [ ] Speech Intel service reachable

## Monitoring

### Disk Usage
```bash
df -h /
docker system df
```
- [ ] Disk usage acceptable (< 70%)

### Container Health
```bash
docker-compose ps
docker-compose logs -f acb-api
```
- [ ] All containers running
- [ ] No crash loops or errors

### Log Rotation (Optional but recommended)
```bash
docker run --rm \
  -v /var/lib/docker/containers:/containers \
  -v /etc/logrotate.d:/etc/logrotate.d:ro \
  -e LOGROTATE_SIZE=100M \
  -e LOGROTATE_FILES=10 \
  --entrypoint logrotate \
  ubuntu /etc/logrotate.d/docker
```
- [ ] Log rotation configured

## Rollback

If deployment fails:
```bash
# Stop ACB services only (keep data)
docker-compose down

# Restore system nginx
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
sudo systemctl reload nginx

# Restart existing services
docker start <forensic-audio-containers>
```

## Success Criteria

- [x] Code cleaned (no paddleocr references)
- [x] Dockerfiles created and tested
- [x] docker-compose.yml prepared
- [x] Nginx routing configured
- [ ] Disk expanded to 50GB+
- [ ] Deployment script ran without errors
- [ ] All 3 ACB containers running
- [ ] HTTPS endpoints responding
- [ ] API successfully calls remote services
- [ ] Frontend loads and makes API calls

## Notes

- Deployment takes 10-15 minutes on first run (image builds)
- Subsequent updates take 2-3 minutes
- No downtime for existing services (speech intel, ocr-api, etc)
- GPU lazy-loads only on API hit (no change to current behavior)
- Database: SQLite stored in acb-data volume (persistent)
- Vector DB: Qdrant stored in qdrant-storage volume (persistent)

## Support

- Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting
- View logs: `docker-compose logs -f <service>`
- SSH to server: `ssh -i ~/Downloads/acb_processor.pem ubuntu@98.86.63.69`
- Contact DevOps for AWS disk expansion assistance

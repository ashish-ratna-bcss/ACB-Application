# ACB Deployment Checklist

## Pre-Deployment (Local)

- [ ] Ensure all code is committed to git
- [ ] Verify `.env` file is correctly configured with API keys
- [ ] Check that `backend/.env` exists (copy from `.env.example` if needed)
- [ ] Review `docker-compose.yml` - all services configured
- [ ] Review `deploy.sh` - deployment script ready

## Server Preparation

- [ ] SSH into server: `ssh -i ~/Downloads/acb_processor.pem ubuntu@98.86.63.69`
- [ ] Verify storage: `df -h /` (should show 100+ GB available)
- [ ] Verify Docker: `docker --version`
- [ ] Verify Docker Compose: `docker-compose --version`
- [ ] Verify network exists: `docker network ls | grep app_default`
  - If not found, create: `docker network create app_default`

## Deployment

- [ ] Clone repository: `cd /home/ubuntu && git clone <repo-url> ACB && cd ACB`
- [ ] Configure .env: `cp backend/.env.example backend/.env` and edit with actual keys
- [ ] Run deployment script: `bash deploy.sh`
- [ ] Verify services running: `docker-compose ps`

## Post-Deployment Verification

- [ ] Check API health:
  ```bash
  docker exec acb-api curl -f http://localhost:8000/health
  ```
- [ ] Check Qdrant health:
  ```bash
  docker exec acb-qdrant curl -f http://localhost:6333/health
  ```
- [ ] Verify database initialized: `docker exec acb-api ls -la /app/acb_documents.db`

## Nginx Integration

- [ ] Update system nginx config to route ACB traffic:
  - See `nginx-acb-routes.conf` for ACB-only routes
  - Or manually add these blocks to existing `/etc/nginx/sites-available/default`:

```nginx
upstream acb-api {
    server acb-api:8000;
}

upstream acb-frontend {
    server acb-frontend:80;
}

# Add to existing server block listening on 443 ssl:

location /api/ {
    proxy_pass http://acb-api/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_request_buffering off;
    client_max_body_size 300m;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}

location /acb/ {
    proxy_pass http://acb-frontend/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- [ ] Test nginx config: `sudo nginx -t`
- [ ] Reload nginx: `sudo systemctl reload nginx`

## Testing

- [ ] Test backend via curl:
  ```bash
  curl -k https://98.86.63.69/api/health
  ```
- [ ] Test frontend loads:
  ```bash
  curl -k https://98.86.63.69/acb/ | head -20
  ```
- [ ] Test in browser:
  - Frontend: https://98.86.63.69/acb/
  - API Docs: https://98.86.63.69/api/docs

## Ongoing Monitoring

- [ ] Set up log monitoring:
  ```bash
  docker-compose logs -f acb-api
  docker-compose logs -f acb-frontend
  docker-compose logs -f acb-qdrant
  ```
- [ ] Monitor disk usage:
  ```bash
  watch -n 60 'df -h / && echo "---" && docker system df'
  ```
- [ ] Check container restart count if unhealthy:
  ```bash
  docker-compose ps
  ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Containers fail to start | `docker-compose logs <service>` to see errors |
| `Connection refused` errors | Verify app_default network exists and containers have access |
| Nginx 502 Bad Gateway | Check if ACB containers are running: `docker ps` |
| High memory/CPU | Check logs for errors, may need to rebuild images |
| Frontend shows API 404 | Verify nginx routing is correct, check browser dev console |

## Backup & Recovery

- [ ] Regular database backups:
  ```bash
  docker exec acb-api tar czf - /app/acb_documents.db | \
    gzip > /backups/acb_db_$(date +%Y%m%d_%H%M%S).tar.gz
  ```
- [ ] Backup Qdrant data:
  ```bash
  docker exec acb-qdrant tar czf - /qdrant/storage | \
    gzip > /backups/qdrant_$(date +%Y%m%d_%H%M%S).tar.gz
  ```
- [ ] Recovery: restore volume before container starts

## Maintenance

- [ ] Weekly: Review logs for errors
- [ ] Monthly: Run `docker system prune -f` to clean up dangling resources
- [ ] As needed: Pull latest code and rebuild:
  ```bash
  git pull
  docker-compose build
  docker-compose up -d
  ```

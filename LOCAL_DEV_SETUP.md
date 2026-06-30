# Local Development Setup

Two distinct setups: **local development** vs **production deployment**.

## Local Development (Your Laptop)

Run frontend and backend **separately** on your machine.

### Backend Setup

```bash
cd backend

# Install dependencies (first time only)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your API keys (or use existing values)

# Run backend on port 8000
python main.py
# Or with uvicorn directly:
# uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: **http://localhost:8000**

### Frontend Setup

```bash
cd acb-demo-application

# Install dependencies (first time only)
npm install

# Frontend automatically uses http://localhost:8000
# (defined in .env.local)
npm start
```

Frontend runs at: **http://localhost:3000**

### How It Works Locally

```
Browser (localhost:3000)
    ↓ calls
Frontend (React)
    ↓ API calls to
Backend (FastAPI on 8000)
```

**Frontend fallback** (in src/utils/api.js and pages):
```javascript
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
```

No .env.local needed — automatically uses `http://localhost:8000` if env var not set.

Optional: Create `acb-demo-application/.env.local` if using non-standard port:
```
REACT_APP_BACKEND_URL=http://localhost:9000
```

## Production Deployment (Server)

Build and run as **Docker containers** with nginx proxy.

### Docker Compose Setup

```bash
# On server, run entire stack with docker-compose
docker-compose up -d
```

Running containers:
- `acb-api` — FastAPI backend on port 8000 (internal, not exposed)
- `acb-frontend` — Nginx serving React on port 80 (internal)
- `acb-qdrant` — Vector DB on port 6333 (internal)

### How It Works in Production

```
Browser (https://98.86.63.69)
    ↓ requests
System nginx (ports 80/443)
    ├─ /api/* → proxies to acb-api:8000
    └─ /* → proxies to acb-frontend:80

Frontend (built into nginx)
    ↓ API calls to /api/...
    ↓ nginx proxies to
Backend (acb-api:8000)
```

**Frontend build arg** (set in docker-compose.yml):
```
REACT_APP_BACKEND_URL=/api
```

Docker builds frontend with relative path `/api` → nginx handles proxy.

## Environment Variables Summary

| Variable | Local Dev | Production |
|----------|-----------|-----------|
| `REACT_APP_BACKEND_URL` | `http://localhost:8000` | `/api` |
| Backend runs on | `localhost:8000` | Docker internal, proxied |
| Frontend runs on | `localhost:3000` | Docker port 80, proxied |
| Access via | Browser → localhost:3000 | Browser → nginx (80/443) |

## Key Differences

| Aspect | Local Dev | Production |
|--------|-----------|-----------|
| **Frontend env** | `.env.local` (direct URL) | Docker build arg (relative path) |
| **Backend access** | Direct connection | Proxied by nginx |
| **Database** | SQLite on disk | Docker volume |
| **Port exposure** | Frontend: 3000, Backend: 8000 | Only nginx: 80, 443 |
| **Build tool** | npm dev server | Docker image |
| **Reload on change** | Yes (auto-reload) | No (production mode) |

## Troubleshooting Local Dev

**Frontend shows "No cases found from http://localhost:8000"**
- Backend not running on port 8000
- Check: `curl http://localhost:8000/health`
- Start backend: `python main.py` in backend/

**CORS errors in browser console**
- Backend not allowing localhost:3000 frontend
- Check backend/app/main.py for CORS configuration
- May need to add localhost:3000 to allowed origins

**"Cannot GET /api/..." errors**
- Frontend trying to call `/api` on localhost
- Should be calling `http://localhost:8000/api`
- Verify .env.local has correct REACT_APP_BACKEND_URL

**Port already in use**
- Backend port 8000 taken: `lsof -i :8000`
- Frontend port 3000 taken: `lsof -i :3000`
- Kill processes or use different ports

## Quick Start (Fresh Local Setup)

```bash
# Terminal 1: Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py

# Terminal 2: Frontend
cd acb-demo-application
npm install
npm start

# Open browser to http://localhost:3000
```

Done. Frontend and backend connected locally.

## Git Ignored Files

Automatically ignored (per .gitignore):
- `acb-demo-application/.env.local` (if created for non-standard ports)
- `backend/.env` (contains real API keys)
- `backend/venv/`
- `acb-demo-application/node_modules/`

Safe to commit:
- `.env.example` files (templates with no secrets)
- `LOCAL_DEV_SETUP.md` (this guide)

## Next Steps

1. Update .gitignore if needed
2. Delete node_modules: `cd acb-demo-application && rm -rf node_modules`
3. Commit setup files
4. Test locally
5. Deploy to server per DEPLOY.md

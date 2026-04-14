# CampusConnect — Setup Guide

Complete step-by-step guide from zero to running.

## Prerequisites

- Python 3.11+
- Node.js 20+
- Redis (for WebSocket server)
- A Supabase account (free tier)
- A Resend account (free tier, for email OTP)

## Step 1: Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run these files in order:
   - `supabase/schema.sql` — creates all tables, indexes, seed data (RLS disabled; authorization is enforced in the FastAPI layer)
   - `supabase/functions.sql` — creates stored procedures and triggers

   > **If you ran an older version of `schema.sql` with RLS enabled**, updates will silently fail (accept/advance/complete/cancel will return 500). Fix by running in the SQL Editor:
   > ```sql
   > ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   > ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
   > ALTER TABLE ratings DISABLE ROW LEVEL SECURITY;
   > ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
   > ```
3. From **Settings > API**, copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` key → this is your `SUPABASE_SERVICE_KEY`

## Step 2: Backend REST API

```bash
cd backend-rest
cp .env.example .env
```

Fill in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=<generate: python -c "import secrets; print(secrets.token_urlsafe(32))">
RESEND_API_KEY=re_...   # Get from resend.com/api-keys
```

Install and run:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test: `curl http://localhost:8000/health`

## Step 3: Backend WebSocket Server

```bash
cd backend-ws
cp .env.example .env
```

Start Redis:
```bash
redis-server &  # or: brew services start redis (macOS)
```

Install and run:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Test: `curl http://localhost:8001/health`

## Step 4: Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Fill in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

Install and run:
```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Step 5: Run Tests

```bash
cd backend-rest
pip install pytest httpx
pytest tests/ -v
```

## Optional: Push Notifications

1. Generate VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Add to `backend-rest/.env`:
   ```
   VAPID_PUBLIC_KEY=BN...
   VAPID_PRIVATE_KEY=...
   VAPID_EMAIL=mailto:you@example.com
   ```
3. Add to `frontend/.env.local`:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BN...
   ```

## Optional: Weather-based Surge Pricing

1. Get a free API key from [openweathermap.org](https://openweathermap.org/api)
2. Add to `backend-rest/.env`:
   ```
   OWM_API_KEY=your-key
   ```

## Deploying to Production

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```

### REST API → AWS Lambda
```bash
cd backend-rest
pip install zappa
zappa deploy production
```

### WebSocket → EC2
```bash
# On a fresh Ubuntu EC2 t3.micro instance:
scp -r backend-ws/ ubuntu@your-ec2:/opt/campusconnect-ws/
ssh ubuntu@your-ec2
chmod +x /opt/campusconnect-ws/ec2-setup.sh
/opt/campusconnect-ws/ec2-setup.sh
```

## Docker (All-in-One Local)

```bash
# From project root
docker compose up --build
```

Services will be available at:
- Frontend: http://localhost:3000
- REST API: http://localhost:8000
- WS Server: ws://localhost:8001

# CampusConnect — NIT Goa P2P Food Delivery

A hyper-local peer-to-peer food delivery web app for NIT Goa campus. Students in the hostel order food from Upahar Ghar or Nescafe, and students already at the canteen ("Campus Pilots") deliver it for a small incentive (₹10-50).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Next.js 14    │────▶│  FastAPI REST    │────▶│  Supabase    │
│   (Vercel)      │     │  (AWS Lambda)    │     │  (PostgreSQL)│
└────────┬────────┘     └─────────────────┘     └──────────────┘
         │
         │ WebSocket
         ▼
┌─────────────────┐     ┌──────────────┐
│  FastAPI WS     │────▶│    Redis     │
│  (EC2 t3.micro) │     │  (pub/sub)   │
└─────────────────┘     └──────────────┘
```

## Features

- **Order food** from Upahar Ghar or Nescafe with a structured menu
- **Campus Pilot mode** — accept deliveries, earn incentives
- **Real-time tracking** — live map with pilot location via WebSocket
- **Chat** — in-order messaging between requester and pilot
- **OTP handover** — secure delivery verification
- **Surge pricing** — dynamic incentive suggestions based on demand + weather
- **Leaderboard** — gamified pilot rankings
- **Push notifications** — pilots get notified of new orders
- **Cash on delivery** — no payment gateway needed
- **PWA** — installable on any phone via "Add to Home Screen"

## Tech Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 14, Tailwind CSS, Zustand, SWR, Leaflet.js | Vercel |
| REST API | FastAPI, Mangum (Lambda adapter) | AWS Lambda |
| WebSocket | FastAPI, Redis pub/sub | EC2 t3.micro |
| Database | PostgreSQL via Supabase | Supabase (free tier) |
| Maps | OpenStreetMap + Leaflet.js | Free |
| Email OTP | Resend | Free tier (3k/mo) |

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd CampusFoodDelivery

# 2. Backend REST
cd backend-rest
cp .env.example .env  # Fill in your keys
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Backend WS (separate terminal)
cd backend-ws
cp .env.example .env
redis-server &
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# 4. Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local
npm install && npm run dev
```

Or with Docker:
```bash
docker compose up --build
```

## Running Tests

```bash
cd backend-rest
pip install pytest httpx
pytest tests/ -v
```

## Project Structure

```
├── supabase/           # Database schema + functions
├── backend-rest/       # FastAPI REST API (→ Lambda)
│   ├── core/           # Config, security, database
│   ├── routers/        # auth, orders, menu, users, leaderboard, push
│   └── tests/          # pytest test suite
├── backend-ws/         # FastAPI WebSocket server (→ EC2)
├── frontend/           # Next.js 14 App Router
│   └── src/
│       ├── app/        # Pages: auth, home, pilot, track, orders, profile, leaderboard
│       ├── components/ # BottomNav, LiveMap, ErrorBoundary, Loaders, Toast
│       ├── hooks/      # useOrderWs, useToast, usePushNotifications
│       ├── lib/        # api.ts, auth-store.ts, cart-store.ts
│       └── types/      # TypeScript interfaces
├── docker-compose.yml
└── .github/workflows/  # CI + deploy pipelines
```

## License

MIT

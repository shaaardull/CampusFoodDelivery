#!/bin/bash
# Setup script for CampusConnect (Frontend + REST API + WebSocket + Redis)
# Works on: EC2 t4g.micro/nano, Lightsail, or any Ubuntu 22.04+

set -euo pipefail

echo "=== CampusConnect Server Setup ==="

# System updates
sudo apt update && sudo apt upgrade -y

# ── Node.js 20 (for Next.js frontend) ────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# ── Python 3, Redis, Nginx, Certbot ──────────────────────────
sudo apt install -y python3 python3-pip python3-venv redis-server nginx certbot python3-certbot-nginx

# Enable and start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# ── WebSocket server ──────────────────────────────────────────
sudo mkdir -p /opt/campusconnect-ws
sudo chown $USER:$USER /opt/campusconnect-ws

cd /opt/campusconnect-ws

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

if [ ! -f .env ]; then
    echo "REDIS_URL=redis://localhost:6379" > .env
    echo "Created .env for WS server"
fi

sudo cp campusconnect-ws.service /etc/systemd/system/

# ── REST API server ───────────────────────────────────────────
sudo mkdir -p /opt/campusconnect-rest
sudo chown $USER:$USER /opt/campusconnect-rest

cd /opt/campusconnect-rest

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env for REST API — EDIT THIS with your Supabase/JWT/Resend keys"
fi

sudo cp campusconnect-rest.service /etc/systemd/system/

# ── Frontend (Next.js standalone) ─────────────────────────────
sudo mkdir -p /opt/campusconnect-frontend
sudo chown $USER:$USER /opt/campusconnect-frontend

if [ -f /opt/campusconnect-frontend/campusconnect-frontend.service ]; then
    sudo cp /opt/campusconnect-frontend/campusconnect-frontend.service /etc/systemd/system/
fi

# ── Enable and start all services ─────────────────────────────
sudo systemctl daemon-reload
sudo systemctl enable campusconnect-ws campusconnect-rest
sudo systemctl start campusconnect-ws campusconnect-rest

if [ -f /etc/systemd/system/campusconnect-frontend.service ]; then
    sudo systemctl enable campusconnect-frontend
fi

# ── Nginx reverse proxy ──────────────────────────────────────
sudo cp /opt/campusconnect-ws/nginx.conf /etc/nginx/sites-available/campusconnect
sudo ln -sf /etc/nginx/sites-available/campusconnect /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "=== Setup complete! ==="
echo "REST API   → port 8000 (nginx: /api/)"
echo "WS server  → port 8001 (nginx: /ws/)"
echo "Frontend   → port 3000 (nginx: /)"
echo "Nginx      → port 80 (proxies all)"

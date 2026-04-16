#!/bin/bash
# Setup script for CampusConnect (Frontend + WebSocket + Redis)
# Works on: EC2 t4g.nano, Lightsail $3.50/mo, or any Ubuntu 22.04+

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

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env (only on first run — CI deploys preserve existing .env)
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example — edit REDIS_URL if needed"
fi

# Install WS systemd service
sudo cp campusconnect-ws.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable campusconnect-ws
sudo systemctl start campusconnect-ws

# ── Frontend (Next.js standalone) ─────────────────────────────
sudo mkdir -p /opt/campusconnect-frontend
sudo chown $USER:$USER /opt/campusconnect-frontend

# Install frontend systemd service (file deployed by CI later)
if [ -f /opt/campusconnect-frontend/campusconnect-frontend.service ]; then
    sudo cp /opt/campusconnect-frontend/campusconnect-frontend.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable campusconnect-frontend
fi

# ── Nginx reverse proxy (frontend + WS) ──────────────────────
sudo cp nginx.conf /etc/nginx/sites-available/campusconnect
sudo ln -sf /etc/nginx/sites-available/campusconnect /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "=== Setup complete! ==="
echo "WS server  → port 8001"
echo "Frontend   → port 3000 (after first CI deploy)"
echo "Nginx      → port 80 (proxies both)"
echo ""
echo "=== Next: SSL (required for HTTPS + WSS) ==="
echo ""
echo "1. Go to https://www.duckdns.org — log in with GitHub"
echo "2. Create a free subdomain (e.g. campusconnect)"
echo "3. Set the IP to this server's public IP"
echo "4. Run: sudo certbot --nginx -d YOUR-SUBDOMAIN.duckdns.org"
echo ""
echo "Your site will be at: https://YOUR-SUBDOMAIN.duckdns.org"

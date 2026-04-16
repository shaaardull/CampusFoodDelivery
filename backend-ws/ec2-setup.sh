#!/bin/bash
# Setup script for CampusConnect WebSocket server
# Works on: AWS Lightsail ($3.50/mo), EC2 t4g.nano, or any Ubuntu 22.04+

set -euo pipefail

echo "=== CampusConnect WS Server Setup ==="

# System updates
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+, Redis, Nginx, Certbot
sudo apt install -y python3 python3-pip python3-venv redis-server nginx certbot python3-certbot-nginx

# Enable and start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Create app directory
sudo mkdir -p /opt/campusconnect-ws
sudo chown $USER:$USER /opt/campusconnect-ws

# Copy files (assumes you've scp'd them or rsync'd via GitHub Actions)
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

# Install systemd service
sudo cp campusconnect-ws.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable campusconnect-ws
sudo systemctl start campusconnect-ws

# Setup Nginx reverse proxy
sudo cp nginx.conf /etc/nginx/sites-available/campusconnect-ws
sudo ln -sf /etc/nginx/sites-available/campusconnect-ws /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "=== Setup complete! ==="
echo "WS server running on port 8001"
echo "Nginx proxying on port 80"
echo ""
echo "=== Next: SSL (required for wss:// from HTTPS frontend) ==="
echo ""
echo "1. Go to https://www.duckdns.org — log in with GitHub"
echo "2. Create a free subdomain (e.g. campusconnect-ws)"
echo "3. Set the IP to this server's public IP"
echo "4. Run: sudo certbot --nginx -d YOUR-SUBDOMAIN.duckdns.org"
echo ""
echo "Your WS URL will be: wss://YOUR-SUBDOMAIN.duckdns.org"

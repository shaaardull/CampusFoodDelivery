#!/bin/bash
# EC2 setup script for CampusConnect WebSocket server
# Run on a fresh Ubuntu 22.04+ t3.micro instance

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

# Copy files (assumes you've scp'd them)
cd /opt/campusconnect-ws

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env
cp .env.example .env

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

echo "=== Setup complete! ==="
echo "WS server running on port 8001"
echo "Nginx proxying on port 80"
echo ""
echo "For SSL, run: sudo certbot --nginx -d your-domain.com"

#!/usr/bin/env bash
# Run this once on a fresh Ubuntu 22/24 droplet as root.
# Usage: bash deploy/setup.sh yourdomain.com

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"
APP_DIR=/opt/pokertrainer
DATA_DIR=/var/data/pokertrainer
APP_USER=pokertrainer

# --- System packages ---
apt-get update -q
apt-get install -y nginx certbot python3-certbot-nginx unzip curl

# --- Dedicated app user (no login shell, no home login) ---
id "$APP_USER" &>/dev/null || useradd --system --shell /usr/sbin/nologin --create-home "$APP_USER"

# --- Install Bun for the app user ---
sudo -u "$APP_USER" bash -c 'curl -fsSL https://bun.sh/install | bash'

# --- App directory ---
mkdir -p "$APP_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR"

# --- Persistent SQLite directory ---
mkdir -p "$DATA_DIR"
chown "$APP_USER":"$APP_USER" "$DATA_DIR"

# --- Clone or pull repo ---
if [ -d "$APP_DIR/.git" ]; then
    sudo -u "$APP_USER" git -C "$APP_DIR" pull
else
    # Replace with your actual repo URL
    sudo -u "$APP_USER" git clone https://github.com/YOUR_USERNAME/pokertrainer.git "$APP_DIR"
fi

sudo -u "$APP_USER" bash -c "cd $APP_DIR && /home/$APP_USER/.bun/bin/bun install --frozen-lockfile"

# --- .env file (edit before running this script, or populate manually after) ---
if [ ! -f "$APP_DIR/.env" ]; then
    cat > "$APP_DIR/.env" <<ENV
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
WEBHOOK_URL=https://${DOMAIN}/sms
PORT=3000
ENV
    chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo "Created $APP_DIR/.env — fill in the Twilio values before starting the service."
fi

# --- systemd service ---
cp "$APP_DIR/deploy/pokertrainer.service" /etc/systemd/system/pokertrainer.service
systemctl daemon-reload
systemctl enable pokertrainer

# --- nginx ---
sed "s/yourdomain.com/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" \
    > /etc/nginx/sites-available/pokertrainer
ln -sf /etc/nginx/sites-available/pokertrainer /etc/nginx/sites-enabled/pokertrainer
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# --- TLS via Let's Encrypt ---
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}"

# --- Start the app ---
echo ""
echo "Setup complete. Fill in $APP_DIR/.env, then run:"
echo "  systemctl start pokertrainer"
echo "  journalctl -fu pokertrainer"

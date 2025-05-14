#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <service_name>"
  exit 1
fi

SERVICE_NAME="$1"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

USER=$(id -u -n)
GROUP=$(id -g -n)

APP_DIR="$HOME/app/$SERVICE_NAME"
ENTRY_POINT="$APP_DIR/index.mjs"
NODE_BIN=$(which node)

echo "Creating systemd service file at $SERVICE_FILE..."
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=$SERVICE_NAME Node.js Service
After=network.target

[Service]
ExecStart=$NODE_BIN --env-file=.env --no-deprecation $ENTRY_POINT
WorkingDirectory=$APP_DIR
Restart=always
User=$USER
Group=$GROUP
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd and enabling the service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "Service $SERVICE_NAME setup completed!"
echo "To start the service, run: sudo systemctl start $SERVICE_NAME"

#!/bin/bash
# This script will alow rplacetk to always run in the background, and auto load on reboot using a systemD unit (only works on linux)

if [ -z "$1" ] then
    echo "Please input the path to the rslashplace2.github.io/rplace server directory"
    exit 0
fi

echo -e "
[Unit]\n
Description=main place websocket server, see http-place for the static http server.\n
After=network.target\n
\n
[Service]\n
Type=simple\n
StandardInput=tty-force\n
TTYVHangup=yes\n
TTYPath=/dev/tty20\n
TTYReset=yes\n
WorkingDirectory=$1\n
ExecStart=/usr/bin/node server.js\n
Restart=always\n
RestartSec=2\n
\n
[Install]\n
WantedBy=multi-user.target\n
" | sudo tee -a /etc/systemd/system/place.service

echo -e "
[Unit]\n
Description=place-http for the static http server, see place for main websocket server.\n
After=network.target\n
\n
[Service]\n
Type=simple\n
StandardInput=tty-force\n
TTYVHangup=yes\n
TTYPath=/dev/tty21\n
TTYReset=yes\n
WorkingDirectory=$1/place_http_server/\n
ExecStart=/usr/bin/node index.js\n
Restart=always\n
RestartSec=2\n
\n
[Install]\n
WantedBy=multi-user.target\n
" | sudo tee -a /etc/systemd/system/http-place.service

sudo systemctl daemon-reload
sudo systemctl enable place.service http-place.service
sudo systemctl start place.service http-place.service

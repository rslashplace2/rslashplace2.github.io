#!/bin/bash
# This script will alow rplacetk to always run in the background, and auto load on reboot using a systemD unit (only works on linux)

if [ -z "$1" ]
then
    echo -e "\x1b[31mPlease input the path to the rplace server directory as an arguument e.g home/pi/rslashplace2.github.io"
    exit 0
fi

node_dir=$(which node)
dotnet_dir=$(which dotnet)

echo -e "
[Unit]
Description=main place websocket server, see http-place for the static http server.
After=network.target

[Service]
Type=simple
StandardInput=tty-force
TTYVHangup=yes
TTYPath=/dev/tty20
TTYReset=yes
WorkingDirectory=$1
ExecStart=
ExecStart=$node_dir server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
" | sudo tee -a /etc/systemd/system/place.service
sudo systemctl daemon-reload

echo -e "
[Unit]
Description=place-http for the static http server, see place for main websocket server.
After=network.target

[Service]
Type=simple
StandardInput=tty-force
TTYVHangup=yes
TTYPath=/dev/tty21
TTYReset=yes
Environment=DOTNET_CLI_HOME=/temp
WorkingDirectory=$1/PlaceHttpsServer/
ExecStart=
ExecStart=$dotnet_dir run
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
" | sudo tee -a /etc/systemd/system/http-place.service
sudo systemctl daemon-reload

sudo systemctl enable place.service http-place.service
sudo systemctl start place.service http-place.service

echo "Task completed."

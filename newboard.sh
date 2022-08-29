#!/bin/bash
#This script will attempt to generate a nwe board (canvas) and accompanying configuration file.
if [ -z "$1" ] || [-z "$2" ] || [ -z "$3" ]
then
    echo -e "\x1b[31mPlease provide arguments for canvas width, height, and cooldown, e.g './newboard.sh 400 400 2'"
    exit 0
fi

sudo systemctl stop place
node -e "fs=require('fs'); fs.writeFileSync('place', new Uint8Array(process.argv[2]*process.argv[3]).fill(31)); fs.unlinkSync('change'); fs.writeFileSync('config.json',JSON.stringify({WIDTH:process.argv[2]>>>0,HEIGHT:process.argv[3]>>>0,COOLDOWN:+process.argv[4]||10e3,PALETTE_SIZE:+process.argv[5]||32, USE_GIT: true, CAPTCHA: true, USE_CLOUDFLARE: false}))" $0 $1 $2
sudo systemctl start place

echo -e "\x1b[32mCompleted! Make sure to edit config.json to configure the server settings before your first run."
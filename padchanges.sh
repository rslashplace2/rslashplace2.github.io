#!/bin/bash
#WARNING: Script only designed to be used on official rplace.tk initial canvas, do not run without modifications if you intend to use for your own solution.
sudo push
sudo systemctl stop place
node -e "fs=require('fs'); let {WIDTH, HEIGHT, PALETTE_SIZE, PALETTE, COOLDOWN, USE_GIT} = JSON.parse(fs.readFile('./config.json')); let CHANGES = fs.readFile('change'); CHANGES=Buffer.concat(CHANGES,Buffer.of(WIDTH*HEIGHT-CHANGES.length))"
sudo systemctl start place
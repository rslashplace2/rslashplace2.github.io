#!/bin/bash
#This script attempts to fix a corrupted board by padding it's changes file.
sudo push
sudo systemctl stop place
node -e "fs=require('fs'); let {WIDTH, HEIGHT, PALETTE_SIZE, COOLDOWN} = JSON.parse(fs.readFile('./config.json')); let CHANGES = fs.readFile('change'); CHANGES=Buffer.concat(CHANGES,Buffer.of(WIDTH*HEIGHT-CHANGES.length))"
sudo systemctl start place
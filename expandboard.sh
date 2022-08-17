#!/bin/bash
sudo systemctl stop place
if [ -z "$1" ]
then
    echo -e "\x1b[31mPlease supply the width and height (THAT IT WILL INCREASE BY) as arguments in order to use this program."
    exit 0
fi
if [ -z "$2" ]
then
    echo -e "\x1b[31mPlease supply the HEIGHT argument."
    exit 0
fi

node -e "
fs=require('fs');
let {WIDTH, HEIGHT, PALETTE_SIZE, COOLDOWN, USE_GIT, CAPTCHA, USE_CLOUDFLARE} = JSON.parse(fs.readFileSync('./config.json'));
let OLDWIDTH = WIDTH, OLDHEIGHT = HEIGHT
let BOARD = fs.readFileSync('place');
HEIGHT += process.argv[0]>>>0;WIDTH += process.argv[1]>>>0;
fs.writeFileSync('config.json',JSON.stringify({WIDTH, HEIGHT, PALETTE_SIZE, COOLDOWN, USE_GIT, CAPTCHA, USE_CLOUDFLARE}));
/*Fill in the empty area now that we have expanded the board's height in config*/
let newBoard = new Uint8Array(WIDTH * HEIGHT).fill(31)
for(let y = 0; y < OLDHEIGHT; y++)newBoard.set(BOARD.subarray(y*OLDWIDTH,(y+1)*OLDWIDTH), y*WIDTH)
fs.writeFileSync('place',newBoard)
" $1 $2
sudo systemctl start place
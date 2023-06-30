#!/bin/bash
#WARNING: Script only designed to be used on official rplace.tk initial canvas, do not run without modifications if you intend to use for your own solution.
sudo rm place
curl https://raw.githubusercontent.com/rslashplace2/rslashplace2.github.io/$1/place -o place
chmod +x place
sudo rm change
push

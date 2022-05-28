sudo systemctl stop place
sudo rm place
curl https://raw.githubusercontent.com/rslashplace2/rslashplace2.github.io/$1/place -o place
chmod +x place
sudo rm change
sudo systemctl start place
push

sudo systemctl stop place
sudo rm place
#Curling from github cleanly is not possible, as there seems to be a bug where it only returns the HTML for the page, instead of just the file we are asking for.
curl https://raw.githubusercontent.com/rslashplace2/rslashplace2.github.io/$1/place -o place
chmod +x place
sudo rm change
sudo systemctl start place
push


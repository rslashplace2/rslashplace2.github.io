sudo systemctl stop place
sudo rm place
#Curling from github cleanly is not possible, as there seems to be a bug where it only returns the HTML for the page, instead of just the file we are asking for.
curl $1 -o place
chmod +x place
sudo rm change
sudo systemctl start place
push


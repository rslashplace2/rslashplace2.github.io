sudo systemctl stop place
sudo rm place
#Curling from github cleanly is not possible, as there seems to be a bug where it only returns the HTML for the page, instead of just the file we are asking for.
curl https://cdn.discordapp.com/attachments/960966748834775052/975358871990329384/place12 -o place
chmod +x place
sudo rm change
sudo systemctl start place
push


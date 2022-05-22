sudo systemctl stop place
node -e "fs=require('fs'); fs.writeFileSync('place', new Uint8Array(process.argv[2]*process.argv[3]).fill(31)); fs.unlinkSync('change'); fs.writeFileSync('config.json',JSON.stringify({WIDTH:process.argv[2]>>>0,HEIGHT:process.argv[3]>>>0,COOLDOWN:+process.argv[4]||10e3,PALETTE_SIZE:+process.argv[5]||32}))" $0 $1 $2
sudo systemctl start place
push

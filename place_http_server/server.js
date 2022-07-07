//Web server
const express = require('express')
const fs = require('fs')
const https = require('https')
const app = express()

//Set 'key' and 'cert' this to the path that certbot gave you for your domain certificate and key
var credentials = { key: fs.readFileSync("/etc/letsencrypt/live/rplace2.ddns.net/privkey.pem"), cert: fs.readFileSync("/etc/letsencrypt/live/rplace2.ddns.net/fullchain.pem")};
var httpServer = https.createServer(credentials, app)

app.get('/', (req, res) => {
	res.send("Rplace place file server is running. Visit [url-of-this-site]/place in order to fetch the place file.")
})

app.get('/place', (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.sendFile(__dirname + "/place")
})

httpServer.listen(8081, () => {
	console.log(`Server listening on port 8081`)
})

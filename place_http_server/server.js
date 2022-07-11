//Web server
const express = require('express')
const fs = require('fs')
const https = require('https')
const cors = require("cors")
const app = express()

//Set 'key' and 'cert' this to the path that certbot gave you for your domain certificate and key
var credentials = { key: fs.readFileSync("/etc/letsencrypt/live/rplace2.ddns.net/privkey.pem"), cert: fs.readFileSync("/etc/letsencrypt/live/rplace2.ddns.net/fullchain.pem")};
var httpsv = https.createServer(credentials, app)

const corsOptions = {
    origin: process.env.CORS_ALLOW_ORIGIN || '*',
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); ; 

app.get('/', (req, res) => {
	res.send("Rplace place file server is running. Visit [url-of-this-site]/place in order to fetch the active place file, [url-of-this-site]/backuplist to view a list of all backups, and fetch from [url-of-this-site]/backups to obtain a backup by it's filename (in backuplist)")
})

app.get('/place', (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.sendFile(__dirname+"/place")
	//res.end()
})

app.get('/backuplist', (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.send(fs.readFileSync(__dirname+"/backuplist.txt").toString())
})

app.use('/backups', express.static(__dirname))
app.use('/backups', serveIndex(__dirname));


httpsv.listen(8081, () => {
	console.log(`Server listening on port 8081`)
})

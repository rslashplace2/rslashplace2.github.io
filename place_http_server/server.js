//Web server
const express = require('express')
const fs = require('fs')
const https = require('https')
const cors = require("cors")
const serveIndex = require('serve-index')
const ffi = require('ffi')
const bodyParser = require("body-parser")
const app = express()

const PORT = 8080

//Set 'key' and 'cert' this to the path that certbot gave you for your domain certificate and key
var credentials = {
	cert: fs.readFileSync("/etc/letsencrypt/live/rplace2.ddns.net/fullchain.pem"),
	key: fs.readFileSync("/etc/letsencrypt/live/rplace2.ddns.net/privkey.pem")
};
const corsOptions = {
    origin: process.env.CORS_ALLOW_ORIGIN || '*',
    methods:['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
var timelapse = ffi.Library('./timelapse_gen/TimelapseGen.dll', {
	'Generate': ["string",["string",["string",["uint",["int",["int",["int",["int"]]]]]]]]
});
var httpsv = https.createServer(credentials, app)

app.use(cors(corsOptions))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/', (req, res) => {
	res.send(`rPlace canvas file server is running. Visit [url-of-domain]:${PORT}/place in order to fetch the active place file, [url-of-domain]${PORT}/backuplist to view a list of all backups, and fetch from [url-of-domain]${PORT}/backups to obtain a backup by it's filename (in backuplist)`)
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

app.post('/timelapse', (req, res) => {
	//string outName, string backupStart, string backupEnd, uint fps, int sX, int sY, int eX, int eY, int sizeX (board width), int sizeY (board height)
	timelapse.Generate(req.body.backupStart, req.body.backupEnd, req.body.fps, req.body.sX, req.body.sY, req.body.eX, req.body.eY, 500, 750)
})

app.use('/backups', express.static(__dirname))
app.use('/backups', serveIndex(__dirname));


httpsv.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`)
})


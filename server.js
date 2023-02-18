// Main rplace server software, (c) BlobKat, Zekiah
import {WebSocketServer} from 'ws' 
import {promises as fs} from 'fs' 
import {createServer} from 'https' 
import sha256 from 'sha256' 
import fsExists from 'fs.promises.exists'
import fetch from 'node-fetch'
import util from 'util'
import genEmojiCaptcha from './zcaptcha/server.js'

let SECURE = true 
let BOARD, CHANGES, VOTES
let { WIDTH, HEIGHT, PALETTE_SIZE, PALETTE, COOLDOWN, USE_GIT, CAPTCHA, USE_CLOUDFLARE } = JSON.parse(await fs.readFile('./config.json'))
try { 
        BOARD = await fs.readFile('./place') 
        CHANGES = await fs.readFile('./change')
        VOTES = new Uint32Array((await fs.readFile('./votes')).buffer)
} catch(e) { 
        BOARD = new Uint8Array(WIDTH * HEIGHT) 
        CHANGES = new Uint8Array(WIDTH * HEIGHT).fill(255) 
        VOTES = new Uint32Array(32)
} 
let newPos = [], newCols = []
let wss, cooldowns = new Map() 

function runLengthChanges(){ 
        //compress CHANGES with run-length encoding 
        let i = 0 
        let bufs = [Buffer.alloc(256)], blast = 0, bi = 0 
        bufs[0][bi++] = 2 
        bufs[0].writeUint32BE(WIDTH, 1) 
        bufs[0].writeUint32BE(HEIGHT, 5)
        bi += 8 
        let add = a => {bufs[blast][bi++]=a;bi==256&&(bi=0,bufs.push(Buffer.alloc(256)),blast++)} 
        while(true){ 
                let c = 0 
                while(CHANGES[i] == 255)c++,i++ 
                if(i == CHANGES.length)break 
                //c is # of blank cells 
                //we will borrow 2 bits to store the blank cell count 
                //00 = no gap 
                //01 = 1-byte (Gaps up to 255) 
                //10 = 2-byte        (Gaps up to 65535) 
                //11 = 4-byte (idk probs never used) 
                if(c < 256){ 
                        if(!c)add(CHANGES[i++]) 
                        else{ 
                                add(CHANGES[i++] + 64) 
                                add(c) 
                        } 
                }else if(c < 65536){ 
                        add(CHANGES[i++] + 128) 
                        add(c >> 8) 
                        add(c) 
                }else{ 
                        add(CHANGES[i++] + 192) 
                        add(c >> 24) 
                        add(c >> 16) 
                        add(c >> 8)
                        add(c) 
                } 
        } 
        bufs[blast] = bufs[blast].slice(0,bi) 
        return Buffer.concat(bufs) 
}

const PORT = 443 
if(SECURE){ 
        wss = new WebSocketServer({ perMessageDeflate: false, server: createServer({ 
        cert: await fs.readFile('../a.pem'), //Path to certbot certificate, i.e: etc/letsencrypt/live/server.rplace.tk/fullchain.pem 
        key: await fs.readFile('../a.key'), //Path to certbot key, i.e: etc/letsencrypt/live/server.rplace.tk/privkey.pem
        perMessageDeflate: false }).listen(PORT) }) 
}else wss = new WebSocketServer({ port: PORT, perMessageDeflate: false }) 

let criticalFiles = ["blacklist.txt", "webhook_url.txt", "bansheets.txt"] 
for (let i = 0; i < criticalFiles.length; i++) { 
        if (!await fsExists(criticalFiles[i])) await fs.writeFile(criticalFiles[i], "", err => { if (err) { console.error(err); return; } }); 
}

let players = 0 
let VIP 
try{VIP = new Set((await fs.readFile('../vip.txt')).toString().split('\n'))}catch(e){} 
const NO_PORT = a => a.split(':')[0].trim() 
let BANS = new Set((await Promise.all(await fs.readFile('bansheets.txt').then(a=>a.toString().trim().split('\n').map(a=>fetch(a).then(a=>a.text()))))).flatMap(a=>a.trim().split('\n').map(NO_PORT))) 
for(let ban of (await fs.readFile('blacklist.txt')).toString().split('\n'))BANS.add(ban) 
let WEBHOOK_URL
try{WEBHOOK_URL = await (fs.readFile("webhook_url.txt")).toString()}catch(e){}
let ORIGIN
try {ORIGIN = await (await fs.readFile("../.git-credentials")).toString().trim()}catch(e){}
let HIST_LEN = 30

let printChatInfo = false
let toValidate = new Map();
const encoderUTF8 = new util.TextEncoder()

let hash = a => a.split("").reduce((a,b)=>(a*31+b.charCodeAt())>>>0,0) 
let allowed = new Set("rplace.tk google.com wikipedia.org pxls.space".split(" ")), censor = a => a.replace(/fuc?k|shi[t]|c[u]nt/gi,a=>"*".repeat(a.length)).replace(/https?:\/\/(\w+\.)+\w{2,15}(\/\S*)?|(\w+\.)+\w{2,15}\/\S*|(\w+\.)+(tk|ga|gg|gq|cf|ml|fun|xxx|webcam|sexy?|tube|cam|p[o]rn|adult|com|net|org|online|ru|co|info|link)/gi, a => allowed.has(a.replace(/^https?:\/\//,"").split("/")[0]) ? a : "").trim()  

wss.on('connection', async function(p, {headers, url: uri}) { 
        p.ip = USE_CLOUDFLARE ? headers['x-forwarded-for'].split(',').pop().split(':',4).join(':') : p._socket.remoteAddress.split(':',4).join(':')
        if ((USE_CLOUDFLARE && headers['origin'] != 'https://rplace.tk') || BANS.has(p.ip)) return p.close()
        let url = uri.slice(1) 
        let IP = /*p._socket.remoteAddress */url || p.ip 
        if(url && VIP != null && !VIP.has(sha256(IP)))return p.close() 
        let CD = url ? (IP.startsWith('!') ? 30 : COOLDOWN / 2) : COOLDOWN 
        if(IP.startsWith("%")){BANS.add(p.ip);fs.appendFile("blacklist.txt","\n"+p.ip);return p.close()} 
        if(!IP)return p.close() 
        if (CAPTCHA) {
                try {
                        let answer, imageData
                        [answer, imageData] = (await genEmojiCaptcha()).split(" ")
                        if (toValidate.has(IP)) toValidate.delete(IP) //if they try to reconnect while pending, we will give them a new one
                        toValidate.set(IP, answer) 
                        p.send(encoderUTF8.encode("\x10" + "\x03" + imageData)) //code, type, image as dataURI
                } catch (e) {console.log(e)}
        }
        p.lchat = 0 //last chat
        p.cdate = NOW //connection date
        p.pHistory = [] //place history
        let buf = Buffer.alloc(9) 
        buf[0] = 1 
        buf.writeInt32BE(Math.ceil(cooldowns.get(IP) / 1000) || 1, 1) 
        buf.writeInt32BE(COOLDOWN, 5) 
        p.send(buf) 
        players++
	p.send(bf)
        p.send(runLengthChanges())
        
        // If a custom palette is defined, then we send to client
        if (Array.isArray(PALETTE)) {
                let paletteBuffer = Buffer.alloc(1 + PALETTE.length * 4)
                paletteBuffer[0] = 0
                for (let i = 0; i < PALETTE.length; i++) {
                        paletteBuffer.writeUInt32BE(PALETTE[i], i + 1)
                }
                p.send(paletteBuffer)
        }
  p.on("error", _=>_) 
  p.on('message', async function(data) { 
                if(data[0] == 15){ 
                        if(p.lchat + 2500 > NOW || data.length > 400) return 
                        p.lchat = NOW 
                        for(let c of wss.clients) { 
                                c.send(data) 
                        } 

                        if (!WEBHOOK_URL) return
                        let txt = data.toString().slice(1), name, messageChannel
                        [txt, name, messageChannel] = txt.split("\n") 
                        if(name) name = name.replace(/\W+/g,'').toLowerCase() 
                        if (!txt) return 
                        try { 
                                txt = txt.replace("@", "") 
                                name = name.replace("@", "") 
                                messageChannel = messageChannel.replace("@", "")
                                if (printChatInfo) {
                                  let date = new Date()
                                  console.log(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] username: ${name || "anon"} (${IP}) content: ${txt}`)
                                }
                                let msgHook = { "username": `[${messageChannel}] ${name || "anon"} @rplace.tk`, "content": txt.replaceAll("@","")} 
                                if (msgHook.content.includes("@") || msgHook.content.includes("http")) return 
                                await fetch(WEBHOOK_URL + "?wait=true", {"method":"POST", "headers": {"content-type": "application/json"}, "body": JSON.stringify(msgHook)}) 
                        } 
                        catch(err) { console.log("Could not post to discord: " + err) }
                        return; 
                } else if (data[0] == 16){ //captcha response
                	let rsp = data.slice(1).toString()
                	if (rsp === toValidate.get(IP)) {
                		toValidate.delete(IP)
                		let dv = new DataView(new ArrayBuffer(2));
                		dv.setUint8(0, 16) //16 is the ceptcha packet
                		dv.setUint8(1, 255) //tell client they have suceeded
                		p.send(dv)
                	} else { return p.close() }
                } else if(data[0] == 99 && CD == 30){ 
                        let w = data[1], h = data[2], i = data.readUInt32BE(3) 
                        if(i%2000+w>=2000)return 
                        if(i+h*2000>=4000000)return 
                        let hi = 0 
                        while(hi < h){ 
                                CHANGES.set(data.slice(hi*w+7,hi*w+w+7),i) 
                                i += 2000 
                                hi++ 
                        } 
                }else if(data[0] == 20){
			p.voted ^= 1 << data[1]
			if(p.voted & (1 << data[1]))VOTES[data[1]&31]++
			else VOTES[data[1]&31]--
		}
                if(data.length < 6)return //bad packet 
                let i = data.readUInt32BE(1), c = data[5] 
                if(i >= BOARD.length || c >= PALETTE_SIZE)return //bad packet 
                    let cd = cooldowns.get(IP) 
                if(cd > NOW){ 
                        //reject 
                        let data = Buffer.alloc(10) 
                        data[0] = 7 
                        data.writeInt32BE(Math.ceil(cd / 1000) || 1, 1) 
                        data.writeInt32BE(i, 5) 
                        data[9] = CHANGES[i] == 255 ? BOARD[i] : CHANGES[i] 
                        p.send(data) 
                        return 
                }
                //accept 
                if (checkAntiGriefBot(p)) return p.close()
                if (checkActiveBuildBot(p)) return p.close()
                if(checkPreban(i%WIDTH, Math.floor(i/HEIGHT), IP)) return p.close()  
                CHANGES[i] = c 
                cooldowns.set(IP, NOW + CD - 500) 
                newPos.push(i) 
                newCols.push(c)
                //antibot
                var data2 = new Uint8Array(data.buffer.byteLength + 8)
                data2.set(data.buffer, 0)
                data2.set(new Uint8Array(8), data.buffer.byteLength)
                let dv = new DataView(data2.buffer)
                dv.setFloat64(6, +NOW) //+NOW is data to number
                p.pHistory.push(dv.buffer)
                if (p.pHistory.length >= HIST_LEN) p.pHistory.shift() //remove oldest hist, lim to 50
  }) 
        p.on('close', function(){ players-- }) 
}) 
let NOW = Date.now() 
setInterval(() => { 
        NOW = Date.now() 
}, 50)

import { exec } from 'child_process' 

async function pushImage(){ 
        for (let i = BOARD.length-1; i >= 0; i--)if(CHANGES[i]!=255)BOARD[i] = CHANGES[i] 
        await fs.writeFile('place', BOARD)

    	if (USE_GIT) {
		await new Promise((r, t) => exec("git commit place -m 'Hourly backup';git push --force "+ORIGIN+"/rslashplace2/rslashplace2.github.io", e => e ? t(e) : r())) 
	} else {
		let dte = new Date().toLocaleString().replaceAll('/', '.').replaceAll(', ', '.')
		await fs.copyFile("./PlaceHttpsServer/place", "./PlaceHttpsServer/place." + dte, 0, err => { if (err) { console.log(err); return; }})
		await fs.copyFile("./place", "./PlaceHttpsServer/place", 0, err => { if (err) { console.log(err); return; }})
		await fs.appendFile("./PlaceHttpsServer/backuplist.txt", "\nplace." + dte, err => { if (err) { console.log(err); return; }})
	}
        //serve old changes for 11 more mins just to be 100% safe 
        let curr = new Uint8Array(CHANGES) 
        setTimeout(() => { 
                //after 11 minutes, remove all old changes. Where there is a new change, curr[i] != CHANGES[i] and so it will be kept, but otherwise, remove 
                for(let i = curr.length - 1; i >= 0; i--)if(curr[i] == CHANGES[i])CHANGES[i] = 255 
        }, 200e3) 
}
setInterval(function(){ 
        if(!newPos.length)return 
        let pos 
        let buf = Buffer.alloc(1 + newPos.length * 5) 
        buf[0] = 6 
        let i = 1 
        while((pos = newPos.pop()) != undefined){ 
                buf.writeInt32BE(pos, i) 
                i += 4 
                buf[i++] = newCols.pop() 
        } 
        for(let c of wss.clients){ 
                c.send(buf) 
        } 
}, 1000) 

let I = 0 
let bf = Buffer.alloc(131); bf[0] = 3
setInterval(async function(){ 
        I++ 
        await fs.writeFile('change', CHANGES) 
        bf[1] = players>>8
	bf[2] = players
	for(let i = 0; i < VOTES.length; i++)bf.writeUint32BE(VOTES[i],(i<<2)+3)
	for (let c of wss.clients) {
                c.send(bf)
        } 
        if(I % 720 == 0){ 
                try { 
                        await pushImage()
			await fs.writeFile('./votes', VOTES)
                        console.log("["+new Date().toISOString()+"] Successfully saved r/place!") 
                } catch(e) { 
                        console.log("["+new Date().toISOString()+"] Error pushing image") 
                } 
                for (let [k, t] of cooldowns) { 
                        if(t > NOW)cooldowns.delete(k) 
                } 
        } 
}, 5000) 

import repl from 'basic-repl' 

let a, c, test 
repl('$',(_)=>eval(_)) 
let O=()=>{console.log("\x1b[31mNothing to confirm!")}, yc = O; 
Object.defineProperties(globalThis, {y: {get(){yc();yc=O}}, n: {get(){yc=O}}}) 
function fill(x, y, x1, y1, b = 27, random = false) { 
        let w = x1-x, h = y1-y 
        for(;y < y1; y++){ 
                for(;x < x1; x++){ 
                        CHANGES[x + y * WIDTH] = random ? Math.floor(Math.random() * 24) :  b 
                } 
                x = x1 - w 
        } 
        return `Filled an area of ${w}*${h} (${(w*h)} pixels), reload the webpage to see the effects` 
} 

// This function is intended to allow us to ban any contributors to a heavily botted area (most likely botters) by banning them as soon as we notice them placing a pixel in such area.  
var prebanArea = { x: 0, y: 0, x1:0, y1:0, banPlaceAttempts:false } 
function setPreban(_x, _y, _x1, _y1, ban = true) { prebanArea = { x: _x, y: _y, x1:_x1, y1:_y1, banPlaceAttempts: ban } }
function clearPreban() { prebanArea = { x:0, y: 0, x1:0, y1:0, banPlaceAttempts: false } }
function checkPreban(incomingX, incomingY, ip) { 
        if (prebanArea.x == 0 && prebanArea.y == 0 && prebanArea.x1 == 0 && prebanArea.y1 == 0) return false 

        if ((incomingX > prebanArea.x && incomingX < prebanArea.x1) && (incomingY > prebanArea.y && incomingY < prebanArea.y1)) { 
                if (prebanArea.banPlaceAttempts === true) { 
                        BANS.add(ip) 
                        fs.appendFile("blacklist.txt","\n"+ip) 
                } 
                console.log(`Pixel placed in preban area at ${incomingX},${incomingY} by ${ip}`) 
                return true 
        }
        return false 
}

//Serverside attempts at most common bot tropés detection
function checkAntiGriefBot(p) { ///all about others, undoing all
		return;
        if (NOW - p.cDate < 3e5) return false //< 5 probably human

        let oPosHistory = [], match = 0
        for (let o of wss.clients) {
                if (o == p) continue
                for(const oData of o.pHistory) oPosHistory.push(oData.buffer.readUInt32BE(1))
        }
        for (let pData of p.pHistory) {
                let dv = new DataView(pData.buffer)
                //if every pixel we have placed, has just been a reset of something in someone else's history, likely
                if (oPosHistory.includes(dv.getUint32(1))) match++
                //if every single colour in history is just a reset to what is alr on the board, likely
                if (BOARD[dv.getUint32(1)] == pData[5]) match++ 
        }
        if (match >= Math.min(p.pHistory.length, 10) + 2) return true
        return false
}

function checkActiveBuildBot(p) { //all about self, building in random placement pattern
		return;
        if (NOW - p.cDate < 6e4) return false

        let match = 0, lDteInterval = 0
        for (let i = 0; i < p.pHistory.length - 1; i++) {
                let dv = new DataView(p.pHistory[i].buffer), nDv = new DataView(p.pHistory[i+1].buffer)
                let x = dv.getUint32(1)%WIDTH, y = Math.floor(dv.getUint32(1)/HEIGHT)
                let nx = nDv.getUint32(1)%WIDTH, ny = Math.floor(nDv.getUint32(1)/HEIGHT)
                let dteInterval = nDv.getFloat64(6) - dv.getFloat64(6)
                //if more than 12px radius, in less than CD+5ms, raise match
                if (Math.abs(nx - x) >= 10 && Math.abs(ny - y) >= 10 && dteInterval <= COOLDOWN + 20) match++
                //if colours are seemingly more random, raise match
                if (p.pHistory[i][5] != p.pHistory[i+1][5]) match++
                //if placing at the same interval each time, raise match
                if (lDteInterval >= dteInterval - 15 && lDteInterval <= dteInterval + 15) match += 2
                lDteInterval = dteInterval
        }
        if (match >= Math.min(p.pHistory.length, 10) + 4) return true
        return false
}



// Broadcast a message as the server to a specific client (p) or all players, in a channel
function announce(msg, channel, p = null) {
	let byteArray = encoderUTF8.encode(`\x0f${msg}\nSERVER@RPLACE.TK\n${channel}`)
	let dv = new DataView(byteArray.buffer)
	dv.setUint8(0, 15)
	if (p != null)
		p.send(dv)
	else
                for(let c of wss.clients) c.send(dv)
}

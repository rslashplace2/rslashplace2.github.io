// Legacy rplace server software, (c) BlobKat, Zekiah
// For the current server software, go to https://github.com/Zekiah-A/RplaceServer
import { WebSocketServer } from 'ws'
import { promises as fs } from 'fs'
import { createServer } from 'https'
import sha256 from 'sha256'
import fsExists from 'fs.promises.exists'
import fetch from 'node-fetch'
import util from 'util'
import path from 'path'
import genEmojiCaptcha from './zcaptcha/server.js'

let BOARD, CHANGES, VOTES

let config = null
try { config = await fs.readFile('./server_config.json') }
catch (e) {
    await fs.writeFile("server_config.json", JSON.stringify({
        "SECURE": true,
        "CERT_PATH": "/etc/letsencrypt/live/path/to/fullchain.pem",
        "KEY_PATH": "/etc/letsencrypt/live/server.rplace.tk/fullchain.pem",
        "PORT": 443,
        "WIDTH": 2000,
        "HEIGHT": 2000,
        "COOLDOWN": 1000,
        "PALETTE_SIZE": 32,
        "PALETTE": null,
        "USE_CLOUDFLARE": true,
        "PUSH_LOCATION": "https://PUSH_USERNAME:MY_PERSONAL_ACCESS_TOKEN@github.com/MY_REPO_PATH",
        "PUSH_PLACE_PATH": "/path/to/local/git/repo",
        "LOCKED": false,
        "CHAT_WEBHOOK_URL": "",
        "MOD_WEBHOOK_URL": "",
        "CHAT_MAX_LENGTH": 400,
        "CHAT_COOLDOWN_MS": 2500
    }, null, 4))

    console.log("Config file created, please update it before restarting the server")
    process.exit(0)
}
let { SECURE, CERT_PATH, PORT, KEY_PATH, WIDTH, HEIGHT, PALETTE_SIZE, PALETTE, COOLDOWN, CAPTCHA, USE_CLOUDFLARE, PUSH_LOCATION, PUSH_PLACE_PATH, LOCKED, CHAT_WEBHOOK_URL, MOD_WEBHOOK_URL, CHAT_MAX_LENGTH, CHAT_COOLDOWN_MS } = JSON.parse(config)

try {
    BOARD = await fs.readFile(path.join(PUSH_PLACE_PATH, "place"))
    CHANGES = await fs.readFile(path.join(PUSH_PLACE_PATH, "change"))
    VOTES = new Uint32Array((await fs.readFile('./votes')).buffer)
} catch (e) {
    BOARD = new Uint8Array(WIDTH * HEIGHT)
    CHANGES = new Uint8Array(WIDTH * HEIGHT).fill(255)
    VOTES = new Uint32Array(32)
}
let newPos = [], newCols = []
let wss, cooldowns = new Map()

function runLengthChanges() {
    //compress CHANGES with run-length encoding 
    let i = 0
    let bufs = [Buffer.alloc(256)], blast = 0, bi = 0
    bufs[0][bi++] = 2
    bufs[0].writeUint32BE(WIDTH, 1)
    bufs[0].writeUint32BE(HEIGHT, 5)
    bi += 8
    let add = a => { bufs[blast][bi++] = a; bi == 256 && (bi = 0, bufs.push(Buffer.alloc(256)), blast++) }
    while (true) {
        let c = 0
        while (CHANGES[i] == 255) c++, i++
        if (i == CHANGES.length) break
        //c is # of blank cells 
        //we will borrow 2 bits to store the blank cell count 
        //00 = no gap 
        //01 = 1-byte (Gaps up to 255) 
        //10 = 2-byte        (Gaps up to 65535) 
        //11 = 4-byte (idk probs never used) 
        if (c < 256) {
            if (!c) add(CHANGES[i++])
            else {
                add(CHANGES[i++] + 64)
                add(c)
            }
        } else if (c < 65536) {
            add(CHANGES[i++] + 128)
            add(c >> 8)
            add(c)
        } else {
            add(CHANGES[i++] + 192)
            add(c >> 24)
            add(c >> 16)
            add(c >> 8)
            add(c)
        }
    }
    bufs[blast] = bufs[blast].slice(0, bi)
    return Buffer.concat(bufs)
}

class DoubleMap { // Bidirectional map
    constructor() {
        this.foward = new Map()
        this.reverse = new Map()
    }

    set(key, value) {
        this.foward.set(key, value)
        this.reverse.set(value, key)
    }

    getForward(key) { return this.foward.get(key) }
    getReverse(value) { return this.reverse.get(value) }

    delete(key) {
        const value = this.foward.get(key)
        this.foward.delete(key)
        this.reverse.delete(value)
    }
    clear() { this.foward.clear(); this.reverse.clear() }
    size() { return this.foward.size }
}

if (SECURE) {
    wss = new WebSocketServer({
        perMessageDeflate: false, server: createServer({
            cert: await fs.readFile(CERT_PATH), //Path to certbot certificate, i.e: etc/letsencrypt/live/server.rplace.tk/fullchain.pem 
            key: await fs.readFile(KEY_PATH), //Path to certbot key, i.e: etc/letsencrypt/live/server.rplace.tk/privkey.pem
            perMessageDeflate: false
        }).listen(PORT)
    })
} else wss = new WebSocketServer({ port: PORT, perMessageDeflate: false })

let criticalFiles = ["blacklist.txt", "webhook_url.txt", "bansheets.txt", "mutes.txt"]
for (let i = 0; i < criticalFiles.length; i++) {
    if (!await fsExists(criticalFiles[i])) await fs.writeFile(criticalFiles[i], "", err => {
        if (err) {
            console.error(err)
            return
        }
    })
}

let players = 0
let playerUids = new Map() // Player ws instance : Uid 
let VIP = new Set()
try { VIP = new Set((await fs.readFile('../vip.txt')).toString().split('\n')) } catch (e) { }
let RESERVED_NAMES = new DoubleMap()
try { // `reserverd_name private_code\n`, for example "zekiah 124215253113\n"
    let reserved_lines = (await fs.readFile('reserved_names.txt')).toString().split('\n')
    for (let pair of reserved_lines) RESERVED_NAMES.set(pair.split(" ")[0], pair.split(" ")[1])
} catch (e) { }
let BANS = new Map((await Promise.all(await fs.readFile('bansheets.txt')
    .then(bansheets => bansheets.toString().trim().split('\n')
    .map(banListUrl => fetch(banListUrl)
    .then(response => response.text())))))
    .flatMap(line => line.trim().split('\n')
    .map((ip) => ip.split(':')[0].trim()))
    .map(banIp => [banIp, Date.now() + 0xFFFFFFFF]))
for (let banFin of (await fs.readFile("blacklist.txt")).toString().split("\n")) {
    let parts = banFin?.split(" ")
    if (!parts || !parts.length) continue
    BANS.set(parts[0], +parts[1] || Date.now() + 0xFFFFFFFF)
}
let MUTES = new Map() // ip : finish (date Number)
try { 
    for (let muteFin of (await fs.readFile("mutes.txt")).toString().split("\n")) {
        let parts = muteFin?.split(" ")
        if (!muteFin || !parts || !parts.length) continue
        MUTES.set(parts[0], +parts[1] || Date.now() + 0xFFFFFFFF)
    }
} catch(e) {}

let printChatInfo = false
let toValidate = new Map();
const encoderUTF8 = new util.TextEncoder()

let allowed = new Set(["rplace.tk", "discord.gg", "twitter.com", "wikipedia.org", "pxls.space", "reddit.com"])
function censorText(text) {
    return text
        .replace(/(sik[ey]rim|orospu|piç|yavşak|kevaşe|ıçmak|kavat|kaltak|götveren|amcık|amcık|[fF][uU][ckr]{1,3}(\\b|ing\\b|ed\\b)?|shi[t]|c[u]nt|((n|i){1,32}((g{2,32}|q){1,32}|[gq]{2,32})[e3r]{1,32})|bastard|bitch|blowjob|clit|cock|cunt|dick|fag|faggot|jizz|lesbian|masturbat(e|ion)|nigga|whore|porn|pussy|r[a4]pe|slut|suck)/gi,
            match => "*".repeat(match.length))
        .replace(/https?:\/\/(\w+\.)+\w{2,15}(\/\S*)?|(\w+\.)+\w{2,15}\/\S*|(\w+\.)+(tk|ga|gg|gq|cf|ml|fun|xxx|webcam|sexy?|tube|cam|p[o]rn|adult|com|net|org|online|ru|co|info|link)/gi,
            match => allowed.has(match.replace(/^https?:\/\//, "").split("/")[0]) ? match : "")
        .trim()
}

wss.on('connection', async function (p, { headers, url: uri }) {
    p.ip = USE_CLOUDFLARE ? headers['x-forwarded-for'].split(',').pop().split(':', 4).join(':') : p._socket.remoteAddress.split(':', 4).join(':')
    if ((USE_CLOUDFLARE && headers['origin'] != 'https://rplace.tk')) return p.close()
    const IP = p.ip
    if (!IP || IP.startsWith("%")) return p.close()
    let ipBanEnd = BANS.get(p.ip)
    if (ipBanEnd && ipBanEnd > NOW) return p.close()
    else if (ipBanEnd && ipBanEnd < NOW) {
        BANS.delete(IP)
        // TODO: Remove player from bans file
        let modMessage = `Client with ip ${p.ip} unbanned by server, reason: Ban time expired.`
        console.log(modMessage)
        if (!MOD_WEBHOOK_URL) return
        let msgHook = { username: "RPLACE SERVER", content: modMessage }
        await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })

    }
    const url = uri?.slice(1)
    let CD = COOLDOWN
    if (url) {
        let codeHash = sha256(url)
        if (!VIP.has(codeHash)) {
            return p.close()
        }
        p.codehash = codeHash
        if (url.startsWith("!")) {
            p.admin = true
            CD = 30
        }
        else {
            p.vip = true
            CD /= 2
        }
    }
    if (CAPTCHA) {
        try {
            const result = await genEmojiCaptcha()
            if (!result) return
            const encodedDummies = encoderUTF8.encode(result.dummies)

            if (toValidate.has(IP)) toValidate.delete(IP) //if they try to reconnect while pending, we will give them a new one
            toValidate.set(IP, result.answer)
            let dv = new DataView(new ArrayBuffer(3 + encodedDummies.byteLength + result.data.byteLength))
            dv.setUint8(0, 16)
            dv.setUint8(1, 3)
            dv.setUint8(2, encodedDummies.byteLength)
            
            const dataArray = new Uint8Array(result.data)
            const dvArray = new Uint8Array(dv.buffer)
            dvArray.set(encodedDummies, 3)
            dvArray.set(dataArray, 3 + encodedDummies.byteLength)
            p.send(dv)
        } catch (e) {
            console.error(e)
        }
    }
    p.lchat = 0 //last chat
    p.cdate = NOW //connection date
    p.pHistory = [] //place history
    let buf = Buffer.alloc(9)
    buf[0] = 1
    buf.writeUint32BE(Math.ceil(cooldowns.get(IP) / 1000) || 1, 1)
    buf.writeUint32BE(LOCKED ? 0xFFFFFFFF : COOLDOWN, 5)
    p.send(buf)
    players++
    p.send(infoBuffer)
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

    playerUids.set(p, sha256(IP))

    p.on("error", _ => _)
    p.on('message', async function (data) {
        switch (data[0]) {
            case 4: { // pixel place
                if (data.length < 6 || LOCKED === true || toValidate.has(IP)) return
                let i = data.readUInt32BE(1), c = data[5]
                if (i >= BOARD.length || c >= PALETTE_SIZE) return
                let cd = cooldowns.get(IP)
                if (cd > NOW) {
                    let data = Buffer.alloc(10)
                    data[0] = 7
                    data.writeInt32BE(Math.ceil(cd / 1000) || 1, 1)
                    data.writeInt32BE(i, 5)
                    data[9] = CHANGES[i] == 255 ? BOARD[i] : CHANGES[i]
                    p.send(data)
                    return
                }
                if (checkPreban(i % WIDTH, Math.floor(i / HEIGHT), IP)) return p.close()
                CHANGES[i] = c
                cooldowns.set(IP, NOW + CD - 500)
                newPos.push(i)
                newCols.push(c)
                break
            }
            case 15: { // chat
                let ipMuteEnd = MUTES.get(p.ip)
                if (ipMuteEnd && ipMuteEnd > NOW) return
                else if (ipMuteEnd && ipMuteEnd < NOW) {
                    MUTES.delete(IP)
                    // TODO: Remove player from mutes file
                    let modMessage = `Client with ip ${p.ip} unmuted by server, reason: Mute time expired.`
                    console.log(modMessage)
                    if (!MOD_WEBHOOK_URL) return
                    let msgHook = { username: "RPLACE SERVER", content: modMessage }
                    await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
                }
                if (p.lchat + (CHAT_COOLDOWN_MS || 2500) > NOW || data.length > (CHAT_MAX_LENGTH || 400)) return
                p.lchat = NOW
                let txt = data.toString().slice(1), name, messageChannel, type = "live", placeX = "0", placeY = "0"
                ;[txt, name, messageChannel, type, placeX, placeY] = txt.split("\n");
                if (!txt || !name || !messageChannel) return
                if (printChatInfo) {
                    let date = new Date()
                    console.log(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] username: ${name} (${IP}/${uid}), (${messageChannel}) content: ${txt}`)
                }

                txt = censorText(txt)
                if (!p.admin && !p.vip) {
                    txt = txt.replace("@everyone", "everyone")
                    txt = txt.replace("@here", "here")
                }
                else if (!p.admin) {
                    txt = txt.replace("@everyone", "everyone")
                }
                let res_name = RESERVED_NAMES.getReverse(name) // reverse = valid code, use reserved name, forward = trying to use name w/out code, invalid
                name = res_name ? res_name + "✓" : censorText(name.replace(/\W+/g, "").toLowerCase()) + (RESERVED_NAMES.getForward(name) ? "~" : "")
                let msgPacket = encoderUTF8.encode("\x0f" + [txt, name, messageChannel, type, placeX, placeY, playerUids.get(p)].join("\n"))
                for (let c of wss.clients) {
                    c.send(msgPacket)
                }

                if (!CHAT_WEBHOOK_URL) {
                    return
                }
                try {
                    txt = txt.replace("@", "")
                    name = name.replace("@", "")
                    messageChannel = messageChannel.replace("@", "")

                    let msgHook = { username: `[${messageChannel}] ${name} @rplace.tk`, content: txt };
                    await fetch(CHAT_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
                } catch (err) {
                    console.log("Could not post chat message to discord: " + err)
                }
                break
            }
            case 16: {
                let rsp = data.slice(1).toString()
                if (rsp === toValidate.get(IP)) {
                    toValidate.delete(IP)
                    let dv = new DataView(new ArrayBuffer(2))
                    dv.setUint8(0, 16)
                    dv.setUint8(1, 255)
                    p.send(dv)
                }
                else {
                    return p.close()
                }
                break;
            }
            case 20: {
                p.voted ^= 1 << data[1]
                if (p.voted & (1 << data[1])) VOTES[data[1] & 31]++
                else VOTES[data[1] & 31]--
                break
            }
            case 98: { // User moderation
                if (p.admin !== true) return
                let action = data[1]

                let modMessage = null
                if (action == 0) {
                    let actionUidLen = data[2]
                    let actionTxt = data.slice(3).toString()
                    let actionUid = actionTxt.slice(0, actionUidLen)
                    let actionCli = null

                    for(let [p, uid] of playerUids) {
                        if(uid === actionUid) actionCli = p
                    }
                    if (actionCli == null) return
    
                    let actionReason = actionTxt.slice(actionUidLen, actionUidLen + 300)

                    if (action == 0) { // kick
                        modMessage = `Moderator ${p.ip} (${p.codehash}) requested to kick user ${
                            actionCli.ip}, with reason: '${actionReason}'`
                        actionCli.close()
                    }
                }
                if (action == 1 || action == 2) { // mute, ban
                    let actionTimeS = data.readUInt32BE(2)
                    let actionUidLen = data[6]
                    let actionTxt = data.slice(7).toString()
                    let actionUid = actionTxt.slice(0, actionUidLen)
                    let actionCli = null

                    for(let [p, uid] of playerUids) {
                        if(uid === actionUid) actionCli = p
                    }
                    if (actionCli == null) return

                    let actionReason = actionTxt.slice(actionUidLen, actionUidLen + 300)
                    modMessage = `Moderator ${p.ip} (${p.codehash}) requested to ${["mute", "ban"][action - 1]
                        } user ${actionCli.ip}, for ${actionTimeS}, with reason: '${actionReason}'`

                    if (action == 1) mute(actionCli, actionTimeS)
                    else if (action == 2) ban(actionCli)
                }
                
                if (!modMessage) return
                console.log(modMessage)
                if (!MOD_WEBHOOK_URL) return
                let msgHook = { username: "RPLACE SERVER", content: modMessage }
                await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })    
            }
            case 99: {
                if (p.admin !== true) return
                let w = data[1], h = data[2], i = data.readUInt32BE(3)
                if (i % 2000 + w >= 2000) return
                if (i + h * 2000 >= 4000000) return
                let hi = 0

                while (hi < h) {
                    CHANGES.set(data.slice(hi * w + 7, hi * w + w + 7), i)
                    i += 2000
                    hi++
                }
                break
            }
        }
    })
    p.on('close', function () { 
        players--
        playerUids.delete(p)
    })
})
let NOW = Date.now()
setInterval(() => {
    NOW = Date.now()
}, 50)

import { exec } from 'child_process'

async function pushImage() {
    for (let i = BOARD.length - 1; i >= 0; i--)if (CHANGES[i] != 255) BOARD[i] = CHANGES[i]
    await fs.writeFile(path.join(PUSH_PLACE_PATH, "place"), BOARD)
    await new Promise((r, t) => exec(`cd ${PUSH_PLACE_PATH};git add -A;git commit -a -m 'Canvas backup';git push --force ${PUSH_LOCATION}`, e => e ? t(e) : r()))

    // Serve old changes for 11 more mins just to be 100% safe of slow git sync or git provider caching
    let curr = new Uint8Array(CHANGES)
    setTimeout(() => {
        // After 11 minutes, remove all old changes. Where there is a new change, curr[i] != CHANGES[i] and so it will be kept, but otherwise, remove 
        for (let i = curr.length - 1; i >= 0; i--)if (curr[i] == CHANGES[i]) CHANGES[i] = 255
    }, 200e3)
}
setInterval(function () {
    if (!newPos.length) return
    let pos
    let buf = Buffer.alloc(1 + newPos.length * 5)
    buf[0] = 6
    let i = 1
    while ((pos = newPos.pop()) != undefined) {
        buf.writeInt32BE(pos, i)
        i += 4
        buf[i++] = newCols.pop()
    }
    for (let c of wss.clients) {
        c.send(buf)
    }
}, 1000)

let pushTick = 0
let infoBuffer = Buffer.alloc(131)
infoBuffer[0] = 3
setInterval(async function () {
    pushTick++
    infoBuffer[1] = players >> 8
    infoBuffer[2] = players
    for (let i = 0; i < VOTES.length; i++) {
        infoBuffer.writeUint32BE(VOTES[i], (i << 2) + 3)
    }
    for (let c of wss.clients) {
        c.send(infoBuffer)
    }

    if (LOCKED) return
    await fs.writeFile(path.join(PUSH_PLACE_PATH, "change"), CHANGES)
    if (pushTick % 720 == 0) {
        try {
            await pushImage()
            await fs.writeFile('./votes', VOTES)
            console.log("[" + new Date().toISOString() + "] Successfully saved r/place!")
        } catch (e) {
            console.log("[" + new Date().toISOString() + "] Error pushing image")
        }
        for (let [k, t] of cooldowns) {
            if (t > NOW) cooldowns.delete(k)
        }
    }
}, 5000)

import repl from 'basic-repl'

let a, c, test
repl('$', (_) => eval(_))
let O = () => { console.log("\x1b[31mNothing to confirm!") }, yc = O;
Object.defineProperties(globalThis, { y: { get() { yc(); yc = O } }, n: { get() { yc = O } } })
function fill(x, y, x1, y1, b = 27, random = false) {
    let w = x1 - x, h = y1 - y
    for (; y < y1; y++) {
        for (; x < x1; x++) {
            CHANGES[x + y * WIDTH] = random ? Math.floor(Math.random() * 24) : b
        }
        x = x1 - w
    }
    return `Filled an area of ${w}*${h} (${(w * h)} pixels), reload the webpage to see the effects`
}

// This function is intended to allow us to ban any contributors to a heavily botted area (most likely botters) by banning them as soon as we notice them placing a pixel in such area.  
var prebanArea = { x: 0, y: 0, x1: 0, y1: 0, banPlaceAttempts: false }
function setPreban(_x, _y, _x1, _y1, ban = true) { prebanArea = { x: _x, y: _y, x1: _x1, y1: _y1, banPlaceAttempts: ban } }
function clearPreban() { prebanArea = { x: 0, y: 0, x1: 0, y1: 0, banPlaceAttempts: false } }
function checkPreban(incomingX, incomingY, ip) {
    if (prebanArea.x == 0 && prebanArea.y == 0 && prebanArea.x1 == 0 && prebanArea.y1 == 0) return false

    if ((incomingX > prebanArea.x && incomingX < prebanArea.x1) && (incomingY > prebanArea.y && incomingY < prebanArea.y1)) {
        if (prebanArea.banPlaceAttempts === true) {
            ban(ip, 0xFFFFFFFF / 1000)
        }

        console.log(`Pixel placed in preban area at ${incomingX},${incomingY} by ${ip}`)
        return true
    }
    return false
}

/**
 * Ban a client using either ip or their websocket instance
 * @param {string|WebSocket} identifier - String client ip address or client websocket instance
*/
function ban(identifier, duration) {
    let ip = null
    if (typeof identifier === "string") {
        ip = identifier
        for (const p of wss.clients) {
            if (p.ip === ip) p.close()
        }
    } else if (identifier instanceof Object) {
        const cli = identifier
        cli.close()
        ip = cli.ip
    }
    if (!ip) return

    let finish = NOW + duration * 1000
    BANS.set(ip, finish)
    fs.appendFile("blacklist.txt", `\n ${ip} ${finish}`)
}

/**
 * Mute a client using either ip or their websocket instance
 * @param {string|WebSocket} identifier - String client ip address or client websocket instance
 *  @param {Number} duration - Integer duration (seconds) for however long this client will be muted for
*/
function mute(identifier, duration) {
    let ip = identifier
    if (identifier instanceof Object) {
        const cli = identifier
        ip = cli.ip
    }
    if (!ip) return
    
    let finish = NOW + duration * 1000
    MUTES.set(ip, finish)
    fs.appendFile("mutes.txt", `\n ${ip} ${finish}`)
}

// Broadcast a message as the server to a specific client (p) or all players, in a channel
function announce(msg, channel, p = null) {
    let byteArray = encoderUTF8.encode(`\x0f${msg}\nSERVER@RPLACE.TK\n${channel}`)
    let dv = new DataView(byteArray.buffer)
    dv.setUint8(0, 15)
    if (p != null) p.send(dv)
    else for (let c of wss.clients) c.send(dv)
}

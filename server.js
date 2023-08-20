/* eslint-disable no-process-exit */
/* eslint-disable no-unused-vars */
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
import * as zcaptcha from './zcaptcha/server.js'
import { isUser } from 'ipapi-sync'
import { Worker, isMainThread } from 'worker_threads'

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
        "CAPTCHA": false,
        "PALETTE_SIZE": 32,
        "PALETTE": null,
        "USE_CLOUDFLARE": true,
        "PUSH_LOCATION": "https://PUSH_USERNAME:MY_PERSONAL_ACCESS_TOKEN@github.com/MY_REPO_PATH",
        "PUSH_PLACE_PATH": "/path/to/local/git/repo",
        "LOCKED": false,
        "CHAT_WEBHOOK_URL": "",
        "MOD_WEBHOOK_URL": "",
        "CHAT_MAX_LENGTH": 400,
        "CHAT_COOLDOWN_MS": 2500,
        "PUSH_INTERVAL_MINS": 30,
        "CAPTCHA_EXPIRY_SECS": 45,
        "CAPTCHA_MIN_MS": 100, //min solvetime
        "INCLUDE_PLACER": false // pixel placer
    }, null, 4))

    console.log("Config file created, please update it before restarting the server")
    process.exit(0)
}
let { SECURE, CERT_PATH, PORT, KEY_PATH, WIDTH, HEIGHT, PALETTE_SIZE, PALETTE, COOLDOWN, CAPTCHA, USE_CLOUDFLARE,
	PUSH_LOCATION, PUSH_PLACE_PATH, LOCKED, CHAT_WEBHOOK_URL, MOD_WEBHOOK_URL, CHAT_MAX_LENGTH, CHAT_COOLDOWN_MS,
	PUSH_INTERVAL_MINS, CAPTCHA_EXPIRY_SECS, CAPTCHA_MIN_MS, INCLUDE_PLACER } = JSON.parse(config)

try { BOARD = await fs.readFile(path.join(PUSH_PLACE_PATH, "place")) }
catch(e) { BOARD = new Uint8Array(WIDTH * HEIGHT) }
try { CHANGES = await fs.readFile(path.join(PUSH_PLACE_PATH, "change")) }
catch(e) { CHANGES = new Uint8Array(WIDTH * HEIGHT).fill(255) }
try { VOTES = new Uint32Array((await fs.readFile('./votes')).buffer) }
catch(e) { VOTES = new Uint32Array(32) }

let newPos = [], newCols = [], newIds = []
let wss, cooldowns = new Map()

const CHANGEPACKET = new DataView(new ArrayBuffer(CHANGES.length + 9))
CHANGEPACKET.setUint8(0, 2)
CHANGEPACKET.setUint32(1, WIDTH)
CHANGEPACKET.setUint32(5, HEIGHT)
const CHANGES32 = new Int32Array(CHANGES.buffer, CHANGES.byteOffset, CHANGES.byteLength >> 2)
function runLengthChanges() {
    //compress CHANGES with run-length encoding 
    let b = 9, i = 0
    while (true) {
        let c = i
        a: {
            if (i & 3) {
                if (CHANGES[i] !== 255) break a
                if (++i & 3) {
                    if (CHANGES[i] !== 255) break a
                    if (++i & 3) {
                        if (CHANGES[i] !== 255) break a
                        ++i
                    }
                }
            }
            i >>= 2; let a
            while ((a = CHANGES32[i]) === -1) i++
            i = i << 2 | (31 - Math.clz32(~a & -~a) >> 3)
        }
        if (i >= CHANGES.length) break
        c = i - c
        //c is # of blank cells
        //we will borrow 2 bits to store the blank cell count 
        //00 = no gap
        //01 = 1-byte (Gaps up to 255) 
        //10 = 2-byte (Gaps up to 65535) 
        //11 = 4-byte (idk probs never used) 
        if (c < 256) {
            if (!c) CHANGEPACKET.setUint8(b++, CHANGES[i++])
            else CHANGEPACKET.setUint16(b, (CHANGES[i++] | 64) << 8 | c), b += 2
        }
        else if (c < 65536) {
            CHANGEPACKET.setUint8(b, CHANGES[i++] | 128)
            CHANGEPACKET.setUint16(b + 1, c)
            b += 3
        }
        else CHANGEPACKET.setUint16(b, (CHANGES[i++] | 192) << 24 | c), b += 4
    }
    return new Uint8Array(CHANGEPACKET.buffer, CHANGEPACKET.byteOffset, b)
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

class PublicPromise {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
    }
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
let VIP = new Set()
try { VIP = new Set((await fs.readFile('../vip.txt')).toString().split('\n')) } catch (e) { /* ignored */ }
let RESERVED_NAMES = new DoubleMap()
try { // `reserverd_name private_code\n`, for example "zekiah 124215253113\n"
    let reserved_lines = (await fs.readFile('reserved_names.txt')).toString().split('\n')
    for (let pair of reserved_lines) RESERVED_NAMES.set(pair.split(" ")[0], pair.split(" ")[1])
} catch (e) { /* ignored */ }
let BLACKLISTED = new Set((await Promise.all(await fs.readFile("bansheets.txt")
    .then(bansheets => bansheets.toString().trim().split('\n')
    .map(banListUrl => fetch(banListUrl)
    .then(response => response.text())))))
    .flatMap(line => line.trim().split('\n')
    .map((ip) => ip.split(':')[0].trim())))
for (let banFin of (await fs.readFile("blacklist.txt")).toString().split("\n")) {
    banFin.trim()
}

let printChatInfo = false
let toValidate = new Map()
let captchaFailed = new Map()
const encoderUTF8 = new util.TextEncoder()
const decoderUTF8 = new util.TextDecoder()

let dbReqId = 0
const dbReqs = new Map()
const dbWorker = new Worker("./db-worker.js")
async function makeDbRequest(message) {
    let handle = dbReqId++
    let promise = new PublicPromise()
    
    message.handle = handle
    dbReqs.set(handle, promise)
    dbWorker.postMessage(message)
    return await promise.promise
}
dbWorker.on("message", (message) => {
    dbReqs.get(message.handle)?.resolve(message.data)
})
dbWorker.on("error", console.warn)

let playerIntIds = new Map() // Player ws instance<Object> : intID<Number>
let playerChatNames = new Map() // Player ws instance<Object>, chatName<String>
let chatMessageId = (await makeDbRequest({ call: "getMaxLiveChatId" })) || 0
let mutes = new Map() // ws client : EndDate
let bans = new Map() // ws client : EndDate

let allowed = new Set(["rplace.tk", "rplace.live", "discord.gg", "twitter.com", "wikipedia.org", "pxls.space", "reddit.com"])
function censorText(text) {
    return text
        .replace(/(sik[ey]rim|orospu|piç|yavşak|kevaşe|ıçmak|kavat|kaltak|götveren|amcık|amcık|[fF][uU][ckr]{1,3}(\\b|ing\\b|ed\\b)?|shi[t]|c[u]nt|((n|i){1,32}((g{2,32}|q){1,32}|[gq]{2,32})[e3r]{1,32})|bastard|b[i1]tch|blowjob|clit|c[o0]ck|cunt|dick|(f[Aa4][g6](g?[oi]t)?)|jizz|lesbian|masturbat(e|ion)|nigga|卐|卍|whore|porn|pussy|r[a4]pe|slut|suck)/gi,
            match => "*".repeat(match.length))
        .replace(/https?:\/\/(\w+\.)+\w{2,15}(\/\S*)?|(\w+\.)+\w{2,15}\/\S*|(\w+\.)+(tk|ga|gg|gq|cf|ml|fun|xxx|webcam|sexy?|tube|cam|p[o]rn|adult|com|net|org|online|ru|co|info|link)/gi,
            match => allowed.has(match.replace(/^https?:\/\//, "").split("/")[0]) ? match : "")
        .trim()
}

wss.on('connection', async function (p, { headers, url: uri }) {
    p.ip = USE_CLOUDFLARE ? headers['x-forwarded-for'].split(',').pop().split(':', 4).join(':') : p._socket.remoteAddress.split(':', 4).join(':')
    if (!isUser(p.ip)) { p.send(Buffer.of()); p.close(); return; }
    if (USE_CLOUDFLARE && headers['origin'] != 'https://rplace.live' && headers['origin'] != 'https://rplace.tk') return p.close()
    const IP = p.ip
    if (!IP || IP.startsWith("%")) return p.close()
    if (BLACKLISTED.has(p.ip)) return p.close()
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
            toValidate.delete(p)
            CD = 30
        }
        else {
            p.vip = true
            CD /= 2
        }
    }
    
    if (CAPTCHA && !p.admin) await forceCaptchaSolve(p)

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
    
    // This section is the only potentially hot DB-related code in the server, investigate optimisatiions
    const pIntId = await makeDbRequest({ call: "getOrCreateUserUid", data: IP })
    p.intId = pIntId
    playerIntIds.set(p, pIntId)
    let pIdBuf = Buffer.alloc(5)
    pIdBuf.writeUInt8(11, 0) // TODO: Integrate into packet 1
    pIdBuf.writeUInt32BE(pIntId, 1)
    p.send(pIdBuf)

    const pName = await makeDbRequest({ call: "getUserChatName", data: IP })
    if (pName) {
        p.chatName = pName
        playerChatNames.set(p, pName)
    }
    let nmInfoBufL = 1
    for (let [p, name] of playerChatNames) nmInfoBufL += encoderUTF8.encode(name).length + 5
    const nmInfoBuf = Buffer.alloc(nmInfoBufL)
    nmInfoBuf.writeUInt8(12, 0)
    let nmI = 1
    for (let [p, name] of playerChatNames) {
        const encName = encoderUTF8.encode(name)
        nmInfoBuf.writeUInt32BE(p.intId, nmI); nmI += 4
        nmInfoBuf.writeUInt8(encName.length, nmI); nmI++
        nmInfoBuf.set(encName, nmI); nmI += encName.length
    }
    p.send(nmInfoBuf)

    //let modBufL = 1
    //let modBuf = Buffer.alloc(32)
   // const punishments = await makeDbRequest({ call: "getPunishments", data: IP })

    p.on("error", console.warn)
    p.on('message', async function (data) {
        switch (data[0]) {
            case 4: { // pixel place
                if (data.length < 6 || LOCKED === true || toValidate.has(p)) return
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
                if (checkPreban(i % WIDTH, Math.floor(i / HEIGHT), p)) return
                CHANGES[i] = c
                cooldowns.set(IP, NOW + CD - 500)
                newPos.push(i)
                newCols.push(c)
                if (INCLUDE_PLACER) newIds.push(p.intId)
                break
            }
            case 12: { // Submit name
                let name = decoderUTF8.decode(data.subarray(1))
                let res_name = RESERVED_NAMES.getReverse(name) // reverse = valid code, use reserved name, forward = trying to use name w/out code, invalid
                name = res_name ? res_name + "✓" : censorText(name.replace(/\W+/g, "").toLowerCase()) + (RESERVED_NAMES.getForward(name) ? "~" : "")
                if (!name || name.length > 16) return

                // Update chatNames so new players joining will also see the name and pass to DB
                p.chatName = name
                playerChatNames.set(p, name)
                dbWorker.postMessage({ call: "setUserChatName", data: { uid: IP, newName: name }})

                // Combine with player intId and alert all other clients of name change
                const encName = encoderUTF8.encode(name)
                const nmInfoBuf = Buffer.alloc(6 + encName.length)
                nmInfoBuf.writeUInt8(12, 0)
                nmInfoBuf.writeUInt32BE(p.intId, 1)
                nmInfoBuf.writeUInt8(encName.length, 5)
                nmInfoBuf.set(encName, 6)

                for (const c of wss.clients) {
                    c.send(nmInfoBuf)
                }
                break
            }
            case 15: { // chat
                if (p.lchat + (CHAT_COOLDOWN_MS || 2500) > NOW || data.length > (CHAT_MAX_LENGTH || 400)) {
                    return
                }
                p.lchat = NOW

                // These may or may not be defined depending on message type
                let channel = null
                let positionIndex = null
                let repliesTo = null

                let offset = 1
                let type = data.readUInt8(offset++)
                let msgLength = data.readUInt16BE(offset); offset += 2
                let message = decoderUTF8.decode(data.subarray(offset, offset + msgLength)); offset += msgLength
                if (type == 0) { // Live chat message
                    let channelLength = data.readUInt8(offset); offset++
                    channel = decoderUTF8.decode(data.subarray(offset, offset + channelLength)); offset += channelLength

                    // If the packet included a message ID it replies to, we include it
                    if (data.byteLength - offset >= 4) {
                        repliesTo = data.readUInt32BE(offset)
                    }
                }
                else {
                    positionIndex = data.readUint32BE(offset)
                }

                if ((type == 0 && !channel) || !message) return
                message = censorText(message)
                if (!p.admin && !p.vip) {
                    message = message.replaceAll("@everyone", "*********")
                    message = message.replaceAll("@here", "*****")
                }
                else if (!p.admin) {
                    message = message.replaceAll("@everyone", "*********")
                }
                
                let encodedChannel = channel && encoderUTF8.encode(channel)
                let encodedTxt = encoderUTF8.encode(message)
                let messageId = ++chatMessageId
                let i = 0;
                const msgPacket = new Uint8Array(encodedTxt.byteLength +
                    (type == 0 ? 18 + encodedChannel?.byteLength + (repliesTo == null ? 0 : 4) : 16))
                msgPacket[i] = 15; i++
                msgPacket[i] = type; i++
                msgPacket[i] = messageId >> 24; i++
                msgPacket[i] = messageId >> 16; i++
                msgPacket[i] = messageId >> 8; i++
                msgPacket[i] = messageId; i++
                msgPacket[i] = encodedTxt.byteLength >> 8; i++
                msgPacket[i] = encodedTxt.byteLength; i++
                msgPacket.set(encodedTxt, i); i += encodedTxt.byteLength
                msgPacket[i] = p.intId >> 24; i++
                msgPacket[i] = p.intId >> 16; i++
                msgPacket[i] = p.intId >> 8; i++
                msgPacket[i] = p.intId; i++
                
                if (type == 0) { // Live chat message
                    msgPacket[i] = NOW >> 24; i++
                    msgPacket[i] = NOW >> 16; i++
                    msgPacket[i] = NOW >> 8; i++
                    msgPacket[i] = NOW; i++
                    msgPacket[i] = 0; i++ // TODO: reactions
                    msgPacket[i] = encodedChannel.byteLength; i++
                    msgPacket.set(encodedChannel, i); i += encodedChannel.byteLength
                    if (repliesTo != null) {
                        msgPacket[i] = repliesTo >> 24; i++
                        msgPacket[i] = repliesTo >> 16; i++
                        msgPacket[i] = repliesTo >> 8; i++
                        msgPacket[i] = repliesTo    
                    }

                    //dbWorker.postMessage({ call: "insertLiveChat", data: { messageId: messageId, message: message,
                    //    name: name, channel: messageChannel, senderUid: IP, sendDate: NOW } })    
                }
                else { // Place (canvas chat message)
                    msgPacket[i] = positionIndex >> 24; i++
                    msgPacket[i] = positionIndex >> 16; i++
                    msgPacket[i] = positionIndex >> 8; i++
                    msgPacket[i] = positionIndex

                    //dbWorker.postMessage({ call: "inserPlaceChat", data: { messageId: messageId, message: message,
                    //    name: name, uid: IP, sendDate: NOW, x: placeX, y: placeY } })
                }
                
                for (let c of wss.clients) {
                    c.send(msgPacket)
                }

                
                if (!CHAT_WEBHOOK_URL) return
                try {
                    const hookMessage = message.replaceAll("@", "")
                    const hookName = p.chatName.replaceAll("@", "")
                    const hookChannel = channel.replaceAll("@", "")

                    let msgHook = { username: `[${hookChannel || 'place chat'}] ${hookName} @rplace.live`, content: hookMessage }
                    await fetch(CHAT_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
                }
                catch (err) {
                    console.log("Could not post chat message to discord: " + err)
                }
                break
            }
            case 16: {
                let response = data.slice(1).toString()
                let info = toValidate.get(p)
                if (info && response === info.answer && info.start + CAPTCHA_EXPIRY_SECS * 1000 > NOW) {
                    captchaFailed.delete(IP)
                    toValidate.delete(p)
                    let dv = new DataView(new ArrayBuffer(2))
                    dv.setUint8(0, 16)
                    dv.setUint8(1, 255)
                    p.send(dv)
                }
                else {
                    let prev = captchaFailed.get(IP)
                    // Block bots attempting to bruteforce captcha quickly
                    if (prev && NOW - prev.last < CAPTCHA_MIN_MS) prev.fails += 3
                    let info = { fails: (prev?.fails || 0) + 1, last: NOW }
                    captchaFailed.set(IP, info)
                    let acceptableFails = Math.min(zcaptcha.config.dummiesCount / 2, 10)
                    if (info.fails < acceptableFails) return p.close()
                    let banLengthS = (info.fails - acceptableFails + 1) ** 2 * 60
                    ban(IP, banLengthS)
                    modWebhookLog(`Client **${IP}** **banned** by server for **${banLengthS
                        }** seconds for failing captcha **${info.fails}** times`)
                }
                break
            }
            case 20: {
                p.voted ^= 1 << data[1]
                if (p.voted & (1 << data[1])) VOTES[data[1] & 31]++
                else VOTES[data[1] & 31]--
                break
            }
            case 98: { // User moderation
                if (p.admin !== true) return
                let offset = 1
                let action = data[offset++]

                if (action == 0) {
                    let actionUidLen = data[offset++]
                    let actionTxt = data.slice((offset += actionUidLen)).toString()
                    let actionUid = actionTxt.slice(0, actionUidLen)
                    let actionCli = null

                    for(let [p, uid] of playerIntIds) {
                        if(uid === actionUid) actionCli = p
                    }
                    if (actionCli == null) return
    
                    let actionReason = actionTxt.slice(actionUidLen, actionUidLen + 300)

                    if (action == 0) { // kick
                        modWebhookLog(`Moderator (${p.codehash}) requested to **kick** user **${
                            actionCli.ip}**, with reason: '${actionReason}'`)
                        actionCli.close()
                    }
                }
                if (action == 1 || action == 2) { // mute, ban
                    let actionTimeS = data.readUInt32BE(2)
                    let actionUidLen = data[6]
                    let actionTxt = data.slice(7).toString()
                    let actionUid = actionTxt.slice(0, actionUidLen)
                    let actionCli = null

                    for(let [p, uid] of playerIntIds) {
                        if(uid === actionUid) actionCli = p
                    }
                    if (actionCli == null) return

                    let actionReason = actionTxt.slice(actionUidLen, actionUidLen + 300)
                    modWebhookLog(`Moderator (${p.codehash}) requested to **${["mute", "ban"][action - 1]
                        }** user **${actionCli.ip}**, for **${actionTimeS}** seconds, with reason: '${actionReason}'`)

                    if (action == 1) mute(actionCli, actionTimeS)
                    else if (action == 2) ban(actionCli)
                }
                if (action == 3) { // Force captcha revalidation
                    let actionUidLen = data[2]
                    let actionTxt = data.slice(3).toString()
                    let actionUid = actionTxt.slice(0, actionUidLen)
                    let actionCli = null

                    if (actionUidLen != 0) {
                        actionCli = null
                        for (let [p, uid] of playerIntIds) {
                            if (uid === actionUid) actionCli = p
                        }
                        if (actionCli == null) return
                        
                        await forceCaptchaSolve(actionCli)
					}
					else {
						for (let c of wss.clients) {
                            forceCaptchaSolve(c)
						}
					}
					
					let actionReason = actionTxt.slice(actionUidLen, actionUidLen + 300)
                    modWebhookLog(`Moderator (${p.codehash}) requested to **force captcha revalidation** for ${
                        actionUidLen == 0 ? '**__all clients__**' : ('user **' + actionCli.ip + '**')}, with reason: '${actionReason}`)
                }
                if (action == 4) { // Set preban
                    let x1, y1, x2, y2, violation

                    modWebhookLog(`Moderator (${p.codeHash}) requested to **set preban area** from (${
                        x1}, ${y1}) to (${x2}, ${y2}), with violation action ${["kick", "ban", "ignore"][violation]}`)
                }
                break
            }
            case 99: {
                if (p.admin !== true) return
                let w = data[1], i = data.readUInt32BE(2)
                let h = Math.floor((data.length - 6) / w)
                if (i % WIDTH + w >= WIDTH || i + h * HEIGHT >= WIDTH * HEIGHT) return

                let hi = 6
                const target = w * h + 6

                while (hi < target) {
                    CHANGES.set(data.subarray(hi, hi + w), i)
                    i += WIDTH
                    hi += w
                }

                modWebhookLog(`Moderator (${p.codehash}) requested to **rollback area** at (${
                    i % WIDTH}, ${Math.floor(i / WIDTH)}), ${w}x${h}px (${w * h} pixels changed)`)
                break
            }
        }
    })
    p.on('close', function () { 
        players--
        playerChatNames.delete(p)
        playerIntIds.delete(p)
        toValidate.delete(p)
    })
})

async function modWebhookLog(message) {
    console.log(message)

    if (!MOD_WEBHOOK_URL) return
    message = message.replace("@", "@​")
    let msgHook = { username: "RPLACE SERVER", content: message }
    await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
}

let NOW = Date.now()
setInterval(() => {
    NOW = Date.now()
}, 50)

let currentCaptcha = zcaptcha.genEmojiCaptcha2

/**
 * Force a client to redo the captcha
 * @param {string|WebSocket} identifier - String client ip address or client websocket instance
*/
async function forceCaptchaSolve(identifier) {
	let cli = identifier
    if (typeof identifier === "string") {
        for (let c of wss.clients) {
            if (c.ip === identifier) cli = identifier
        }
    }
    if (!cli) return
    
    try {
        const result = await currentCaptcha()
        if (!result) return cli.close()
        const encodedDummies = encoderUTF8.encode(result.dummies)

        toValidate.set(cli, { start: NOW, answer: result.answer })
        let dv = new DataView(new ArrayBuffer(3 + encodedDummies.byteLength + result.data.byteLength))
        dv.setUint8(0, 16)
        dv.setUint8(1, 3)
        dv.setUint8(2, encodedDummies.byteLength)

        const dataArray = new Uint8Array(result.data)
        const dvArray = new Uint8Array(dv.buffer)
        dvArray.set(encodedDummies, 3)
        dvArray.set(dataArray, 3 + encodedDummies.byteLength)
        cli.send(dv)
    }
    catch (e) {
        console.error(e)
        cli.close()
    }
}

import { exec } from 'child_process'

async function pushImage() {
    for (let i = BOARD.length - 1; i >= 0; i--)if (CHANGES[i] != 255) BOARD[i] = CHANGES[i]
    await fs.writeFile(path.join(PUSH_PLACE_PATH, "place"), BOARD)
	await fs.unlink(path.join(PUSH_PLACE_PATH, ".git/index.lock"), (e) => { }).catch((e) => { })
    await new Promise((r, t) => exec(`cd ${PUSH_PLACE_PATH};git add -A;git commit -a -m 'Canvas backup';git push --force ${PUSH_LOCATION}`, e => e ? t(e) : r()))

    // Serve old changes for 11 more mins just to be 100% safe of slow git sync or git provider caching
    let curr = new Uint8Array(CHANGES)
    setTimeout(() => {
        // After 11 minutes, remove all old changes. Where there is a new change, curr[i] != CHANGES[i] and so it will be kept, but otherwise, remove 
        for (let i = curr.length - 1; i >= 0; i--)if (curr[i] == CHANGES[i]) CHANGES[i] = 255
    }, 200e3)
}

let captchaTick = 0
setInterval(function () {
    fs.appendFile("./pxps.txt", "\n" + newPos.length)
    if (!newPos.length) return
    let pos, buf
    if (INCLUDE_PLACER) {
        buf = Buffer.alloc(1 + newPos.length * 9)
        buf[0] = 5
    }
    else {
        buf = Buffer.alloc(1 + newPos.length * 5)
        buf[0] = 6
    }
    let i = 1
    while ((pos = newPos.pop()) != undefined) {
        buf.writeInt32BE(pos, i); i += 4
        buf[i++] = newCols.pop()
        if (INCLUDE_PLACER) buf.writeInt32BE(newIds.pop(), i)
    }
    for (let c of wss.clients) {
        c.send(buf)
    }

    // Captcha tick
    if (captchaTick % CAPTCHA_EXPIRY_SECS == 0) {
        for (let [c, info] of toValidate.entries()) {
            if (info.start + CAPTCHA_EXPIRY_SECS * 1000 < NOW) {
                c.close()
                toValidate.delete(c.ip)
            }
        }

        // How long before the server will forget their captcha fails
        for (let [ip, info] of captchaFailed.entries()) {
            if (info.last + 2 ** info.fails < NOW) captchaFailed.delete(ip)
        }
    }
    captchaTick++
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

    fs.appendFile("./stats.txt", "\n" + players)
    if (LOCKED) return
    await fs.writeFile(path.join(PUSH_PLACE_PATH, "change" + (pushTick & 1 ? "2" : "")), CHANGES)
    if (pushTick % (PUSH_INTERVAL_MINS / 5 * 60) == 0) {
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
import { channel } from 'diagnostics_channel'

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
const prebanArea = { x: 0, y: 0, x1: 0, y1: 0, action: "kick" } // kick, ignore, ban, or function(p, x, y): bool
function setPreban(_x, _y, _x1, _y1, _action = "kick") {
    prebanArea.x = _x; prebanArea.y = _y; prebanArea.x1 = _x1; prebanArea.y1 = _y1; prebanArea.action = _action;
}
function clearPreban() {
    prebanArea.x = 0; prebanArea.y = 0; prebanArea.x1 = 0; prebanArea.y1 = 0; prebanArea.action = "kick";
}
function checkPreban(incomingX, incomingY, p) {
    if (prebanArea.x == 0 && prebanArea.y == 0 && prebanArea.x1 == 0 && prebanArea.y1 == 0) return false
    if ((incomingX > prebanArea.x && incomingX < prebanArea.x1) && (incomingY > prebanArea.y && incomingY < prebanArea.y1)) {
        if (prebanArea.action instanceof Function) {
            return prebanArea.action(p, incomingX, incomingY)            
        }
        if (prebanArea.action == "ban") {
            ban(p.ip, 0xFFFFFFFF / 1000)
            return true
        }
        if (prebanArea.action == "kick") {
            p.close()
            return true
        }
        if (prebanArea.action == "ignore") {
            return true
        }

        console.log(`Pixel placed in preban area at ${incomingX},${incomingY} by ${p.ip}`)
    }

    return false
}

/**
 * Ban a client using either ip or their websocket instance
 * @param {string|WebSocket} identifier - String client ip address or client websocket instance
*/
function ban(identifier, duration, reason = null, mod = null) {
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
    BLACKLISTED.set(ip, finish)
    fs.appendFile("blacklist.txt", `\n${ip} ${finish}`)
    //dbWorker.postMessage({ call: "insertBan", data: { uidType: "IP" } })
}

/**
 * Mute a client using either ip or their websocket instance
 * @param {string|WebSocket} identifier - String client ip address or client websocket instance
 * @param {Number} duration - Integer duration (seconds) for however long this client will be muted for
*/
function mute(identifier, duration, reason = null, mod = null) {
    /*let ip = identifier
    if (identifier instanceof Object) {
        const cli = identifier
        ip = cli.ip
    }
    if (!ip) return
    
    let finish = NOW + duration * 1000
    MUTES.set(ip, finish)
    fs.appendFile("mutes.txt", `\n ${ip} ${finish}`)*/
}

function blacklist(identifier) {
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

    BLACKLISTED.set(ip, Infinity)
    fs.appendFile("blacklist.txt", "\n" + ip)
}

// Broadcast a message as the server to a specific client (p) or all players, in a channel
//function announce(msg, channel, p = null) {
//    let byteArray = encoderUTF8.encode(`\x0f${msg}\nSERVER@RPLACE.LIVE✓\n${channel}`)
//    let dv = new DataView(byteArray.buffer)
//    dv.setUint8(0, 15)
//    if (p != null) p.send(dv)
//    else for (let c of wss.clients) c.send(dv)
//}

let shutdown = false
process.on("uncaughtException", console.warn)
process.on('SIGINT', function () {
    if (shutdown) {
        console.log("Bruh impatient")
        process.exit(0)
    }
    else {
        shutdown = true
        process.stdout.write("\rShutdown received. Wait a sec");
        for (let c of wss.clients) {
            c.close()
        }

        (async function() {
            await makeDbRequest({ call: "commitShutdown" })
            console.log("rBye-bye!                             ")
            process.exit(0)
        })()
    }
})
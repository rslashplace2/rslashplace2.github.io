/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-check
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-jsdoc */
// Legacy rplace server software, (c) BlobKat, Zekiah
// For the current server software, go to https://github.com/Zekiah-A/RplaceServer
import { promises as fs } from 'fs'
import sha256 from 'sha256'
import fsExists from 'fs.promises.exists'
import fetch from 'node-fetch'
import util from 'util'
import path from 'path'
import * as zcaptcha from './zcaptcha/server.js'
import { isUser } from 'ipapi-sync'
import { Worker } from 'worker_threads'
import cookie from 'cookie'
import repl from 'basic-repl'
import { $ } from "bun"

let BOARD, CHANGES, VOTES

let config = null
try { config = await fs.readFile("./server_config.json") }
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
        "ORIGINS": [ "https://rplace.live", "https://rplace.tk" ],
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
        "INCLUDE_PLACER": false, // pixel placer
        "SECURE_COOKIE": true,
        "CORS_COOKIE": false,
    }, null, 4))

    console.log("Config file created, please update it before restarting the server")
    process.exit(0)
}
let { SECURE, CERT_PATH, PORT, KEY_PATH, WIDTH, HEIGHT, PALETTE_SIZE, ORIGINS, PALETTE, COOLDOWN, CAPTCHA,
    USE_CLOUDFLARE, PUSH_LOCATION, PUSH_PLACE_PATH, LOCKED, CHAT_WEBHOOK_URL, MOD_WEBHOOK_URL, CHAT_MAX_LENGTH,
    CHAT_COOLDOWN_MS, PUSH_INTERVAL_MINS, CAPTCHA_EXPIRY_SECS, CAPTCHA_MIN_MS, INCLUDE_PLACER, SECURE_COOKIE,
    CORS_COOKIE } = JSON.parse(config.toString())

try { BOARD = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "place")).arrayBuffer()) }
catch(e) { BOARD = new Uint8Array(WIDTH * HEIGHT) }
try { CHANGES = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "change")).arrayBuffer()) }
catch(e) { CHANGES = new Uint8Array(WIDTH * HEIGHT).fill(255) }
try { VOTES = new Uint32Array(await Bun.file("./votes").arrayBuffer()) }
catch(e) { VOTES = new Uint32Array(32) }
let uidToken = null
try { uidToken = (await fs.readFile("uidtoken.txt")).toString() }
catch(e) { 
    uidToken = "UidToken_" + Math.random().toString(36).slice(2)
    await fs.writeFile("uidtoken.txt", uidToken)
}

let newPos = [], newCols = [], newIds = []
const cooldowns = new Map()

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

const criticalFiles = ["blacklist.txt", "webhook_url.txt", "bansheets.txt", "mutes.txt", "vip.txt", "reserved_names.txt"]
for (let i = 0; i < criticalFiles.length; i++) {
    if (!await fsExists(criticalFiles[i])) await fs.writeFile(criticalFiles[i], "")
}

/**
 * @param {number} length Length of generated random string
 * @returns {string} random string
 */
function randomString(length) {
    const buf = new Uint8Array(length)
    crypto.getRandomValues(buf)
    let str = ""
    for (let i = 0; i < buf.length; i++) {
        str += (buf[i].toString(16))
    }

    return str.slice(0, length)
}

let playersOffset = 0
Object.defineProperty(globalThis, "realPlayers", {
    get: function() {
        return wss.clients.size
    }
})
Object.defineProperty(globalThis, 'players', {
    get: function() { return realPlayers + playersOffset; },
    set: function(value) { playersOffset = value - realPlayers; }
});

const RESERVED_NAMES = new DoubleMap()
// `reserved_name private_code\n`, for example "zekiah 124215253113\n"
const reservedLines = ((await fs.readFile("reserved_names.txt")).toString()).split('\n')
for (const pair of reservedLines) RESERVED_NAMES.set(pair.split(' ')[0], pair.split(' ')[1])
const BLACKLISTED = new Set(
    (await Promise.all((
        (await fs.readFile("bansheets.txt")).toString()
            .trim()
            .split('\n')
            .map(banListUrl => fetch(banListUrl).then(response => response.text())))))
    .flatMap(line => line.trim().split('\n').map(ip => ip.split(':')[0].trim())))

for (const ban of (await fs.readFile("blacklist.txt")).toString().split('\n')) {
    BLACKLISTED.add(ban)
}

const toValidate = new Map()
const captchaFailed = new Map()
const encoderUTF8 = new util.TextEncoder()
const decoderUTF8 = new util.TextDecoder()

let dbReqId = 0
const dbReqs = new Map()
const dbWorker = new Worker("./db-worker.js")
/** 
 * __Always await this__, and only use in cases where you __WANT the response__, if you want something that
 * you can just fire and forget then use dbWorker.postMessage instead.
 * @param {({call: string, data: any, handle?: number}|string)} messageCall - String method name | Method call + arguments to be executed on DB worker.
 * @param {object} args - Arguments that makeDbRequest will use.
 */
async function makeDbRequest(messageCall, args = null) {
    const handle = dbReqId++
    const promise = new PublicPromise()
    
    if (typeof messageCall === "object" && messageCall?.call)
        messageCall.handle = handle
    else if (typeof messageCall === "string")
        messageCall = { call: messageCall, data: args, handle: handle }
    else
        throw new Error("DB request fail. Invalid arguments (string name, any[] args)|({call: string name,data: any[] args})")
    
    dbReqs.set(handle, promise)
    dbWorker.postMessage(messageCall)
    return await promise.promise
}
dbWorker.on("message", (message) => {
    dbReqs.get(message.handle)?.resolve(message.data)
})
dbWorker.on("error", console.warn)

const playerIntIds = new Map() // Player ws instance<Object> : intID<Number>
const playerChatNames = new Map() // intId<Number> : chatName<String>
let liveChatMessageId = (await makeDbRequest("getMaxLiveChatId")) || 0
let placeChatMessageId = (await makeDbRequest("getMaxPlaceChatId")) || 0
const mutes = new Map() // IP : finishDate (unix epoch offset ms)
const bans = new Map() // IP : finishDate (unix epoch offset ms)
const activeVips = new Map() // String VIP key : client

// vip key, cooldown
const vipTxt = (await fs.readFile("./vip.txt")).toString()
if (!vipTxt) {
    Bun.write("./vip.txt",
        "# VIP Key configuration file\n" +
        "# Below is the correct format of a VIP key configuration:\n" +
        "# MY_SHA256_HASHED_VIP_KEY { perms: \"canvasmod\"|\"chatmod\"|\"admin\",\"vip\", cooldownMs: N }\n\n" +
        "# Example VIP key configuration:\n" +
        "# 7eb65b1afd96609903c54851eb71fbdfb0e3bb2889b808ef62659ed5faf09963 { \"perms\": \"admin\", \"cooldownMs\": 30 }\n" +
        "# Make sure all VIP keys stored here are sha256 hashes of the real keys you hand out\n")
}
function readVip(vipTxt) {
    return new Map(vipTxt
        .split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .map(pair => [ pair.trim().slice(0, 64), JSON.parse(pair.slice(64).trim()) ]))
}
const VIP = readVip(vipTxt)
;(async function() {
    for await (const _ of fs.watch("./vip.txt")) {
        const beforeKeys = VIP.size
        try {
            const vipTxt = (await fs.readFile("./vip.txt")).toString()
            const newVip = readVip(vipTxt)
            const addedKeys = new Map([...newVip].filter(([k]) => !VIP.has(k)))
            const removedKeys = new Map([...VIP].filter(([k]) => !newVip.has(k)))
            const modifiedKeys = new Map([...newVip].filter(([k, v]) => VIP.has(k) && VIP.get(k) !== v))

            // Update VIP map
            for (const [k, v] of addedKeys) VIP.set(k, v)
            for (const [k] of removedKeys) VIP.delete(k)
            for (const [k, v] of modifiedKeys) VIP.set(k, v)
            let removedClients = 0 
            for (const k of removedKeys) {
                const activeClient = activeVips.get(k)
                if (activeClient) {
                    removedClients++
                    activeClient.close()
                }
            }
            console.log(`Change in VIP config detected, VIP updated: ${beforeKeys} keys -> ${VIP.size} keys detected. ${
                addedKeys.size > 0 ? `${addedKeys.size} keys found to be added. `: ""} ${
                removedKeys.size > 0 ? `${removedKeys.size} keys found to be removed.`: ""} ${
                modifiedKeys.size > 0 ? `${modifiedKeys.size} keys found to be modified. ` : ""} ${
                removedClients > 0 ? `${removedClients} active key users removed.` : ""}`)
        }
        catch(e) {
            console.log("Error reading or updating VIP:", e)
        }
    }
})()

const PUNISHMENT_STATE = {
    mute: 0,
    ban: 1,
    appealRejected: 2,
}

// Fetch all mutes, bans
const muteIdFinishes = await makeDbRequest("exec", {
    stmt: "SELECT userIntId AS intId, finishDate FROM Mutes WHERE finishDate > ?",
    params: Date.now() })
for (const idFinish of muteIdFinishes) {
    const idIps = await makeDbRequest("exec", {
        stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?",
        params: idFinish.intId })
    for (const ipObject of idIps) {
        mutes.set(ipObject.ip, idFinish.finishDate)
    }
}
const banIdFinishes = await makeDbRequest("exec", {
    stmt: "SELECT userIntId AS intId, finishDate FROM Bans WHERE finishDate > ?",
    params: Date.now() })
for (const idFinish of banIdFinishes) {
    const idIps = await makeDbRequest("exec", {
        stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?",
        params: idFinish.intId })
    for (const ipObject of idIps) {
        bans.set(ipObject.ip, idFinish.finishDate)
    }
}

// Server is player ID 0, all server messages have message ID 0
playerChatNames.set(0, "SERVER@RPLACE.LIVE✓")

let allowed = new Set(["rplace.tk", "rplace.live", "discord.gg", "twitter.com", "wikipedia.org", "pxls.space", "reddit.com"])
/**
 * 
 * @param {string} text Input text to be sanitised 
 * @returns {string} sanitised string
 */
function censorText(text) {
    return text
        .replace(/(sik[ey]rim|orospu|piç|yavşak|kevaşe|ıçmak|kavat|kaltak|götveren|amcık|amcık|[fF][uU][ckr]{1,3}(\\b|ing\\b|ed\\b)?|shi[t]|c[u]nt|((n|i){1,32}((g{2,32}|q){1,32}|[gq]{2,32})[e3r]{1,32})|bastard|b[i1]tch|blowjob|clit|c[o0]ck|cunt|dick|(f[Aa4][g6](g?[oi]t)?)|jizz|lesbian|masturbat(e|ion)|nigga|卐|卍|whore|porn|pussy|r[a4]pe|slut|suck)/gi,
            match => "*".repeat(match.length))
        .replace(/https?:\/\/(\w+\.)+\w{2,15}(\/\S*)?|(\w+\.)+\w{2,15}\/\S*|(\w+\.)+(tk|ga|gg|gq|cf|ml|fun|xxx|webcam|sexy?|tube|cam|p[o]rn|adult|com|net|org|online|ru|co|info|link)/gi,
            match => allowed.has(match.replace(/^https?:\/\//, "").split("/")[0]) ? match : "")
        .trim()
}

/**
 * @param {number} type (0|1) message type (0 - Live chat message, 1 - place chat message)
 * @param {string} message Message text content (maxlen(65534))
 * @param {number} sendDate Unix epoch offset __**seconds**__ of message send
 * @param {number} messageId Message integer id (u32)
 * @param {number} intId Sender integer id (u32)
 * @param {string?} channel String channel (maxlen(16))
 * @param {number?} repliesTo Integer message id replies to (u32)
 * @param {number?} positionIndex Index on canvas of place chat message (u32)
 * @returns {Buffer} Message packet data prepended with packet code (15)
 */
function createChatPacket(type, message, sendDate, messageId, intId, channel = null, repliesTo = null, positionIndex = null) {
    const encodedChannel = channel && encoderUTF8.encode(channel)
    const encodedTxt = encoderUTF8.encode(message)
    const msgPacket = Buffer.allocUnsafe(encodedTxt.byteLength +
        (type == 0 ? 18 + encodedChannel?.byteLength + (repliesTo == null ? 0 : 4) : 16))

    let i = 0
    msgPacket[i] = 15; i++
    msgPacket[i] = type; i++
    msgPacket.writeUInt32BE(messageId, i); i += 4
    msgPacket.writeUInt16BE(encodedTxt.byteLength, i); i += 2
    msgPacket.set(encodedTxt, i); i += encodedTxt.byteLength
    msgPacket.writeUInt32BE(intId, i); i +=  4
    
    if (type == 0) { // Live chat message
        msgPacket.writeUInt32BE(sendDate, i); i += 4
        // TODO: reactions
        msgPacket[i] = 0; i++
        // TODO: reactions
        msgPacket[i] = encodedChannel.byteLength; i++
        msgPacket.set(encodedChannel, i); i += encodedChannel.byteLength
        if (repliesTo != null) {
            msgPacket.writeUInt32BE(repliesTo, i); i += 4
        }
    }
    else { // Place (canvas chat message)
        msgPacket.writeUInt32BE(positionIndex, i); i += 4
    }

    return msgPacket
}

/**
 * 
 * @param {Map<number, string>} names IntId : String names map to be encoded
 * @returns {Buffer} Name packet data prepended with packet code (12)
 */
function createNamesPacket(names) {
    let size = 1
    const encodedNames = new Map()
    for (const [intId, name] of names) {
        const encName = encoderUTF8.encode(name)
        encodedNames.set(intId, encName)
        size += encName.length + 5
    }

    const infoBuffer = Buffer.allocUnsafe(size)
    infoBuffer[0] = 12
    let i = 1
    for (const [intId, encName] of encodedNames) {
        infoBuffer.writeUInt32BE(intId, i); i += 4
        infoBuffer.writeUInt8(encName.length, i); i++
        infoBuffer.set(encName, i); i += encName.length
    }

    return infoBuffer
}

/**
 * @param {typeof PUNISHMENT_STATE.mute|typeof PUNISHMENT_STATE.ban} type Punishment type being applied
 * @param {number} startDate Punishment action creation (start) date
 * @param {number} finishDate Punishment action finish date
 * @param {string} reason Reason set by moderator and shared to client for why they were punished
 * @param {string} userAppeal String appeal that the user provided against their own punishment
 * @param {boolean} appealRejected Boolean indicating whether appeal is rejected and no logner editable
 * @returns {Buffer}
 */
function createPunishPacket(type, startDate, finishDate, reason, userAppeal, appealRejected) {
    const encReason = encoderUTF8.encode(reason)
    const encAppeal = encoderUTF8.encode(userAppeal)
    const buf = Buffer.allocUnsafe(12 + encReason.byteLength + encAppeal.byteLength)

    let offset = 0
    buf[offset++] = 14
    buf[offset++] = type | (appealRejected ? PUNISHMENT_STATE.appealRejected : 0) // state
    buf.writeUInt32BE(startDate / 1000, offset); offset += 4
    buf.writeUInt32BE(finishDate / 1000, offset); offset += 4
    buf[offset++] = encReason.byteLength
    buf.set(encReason, offset); offset += encReason.byteLength
    buf[offset++] = encAppeal.byteLength
    buf.set(encAppeal, offset); offset += encAppeal.byteLength
    return buf
}

/**
 * If a user changes their intId, they will still be banned, as it applies recursively to every IP used by that intId, however
 * they will not receive the detailed info on why they were banned, instead just receiving when their ban finishes. They will also
 * not be able to appeal the action
 * @param {import('bun').ServerWebSocket} ws - Websocket client that punishments will be applied for
 * @param {number} intId - Integer ID of player to have punishments scanned for
 * @param {string} ip - IP address of client to have punishments applied and scanned for
 */
async function applyPunishments(ws, intId, ip) {
    const banFinish = bans.get(ip)
    if (banFinish) {
        if (banFinish < NOW) {
            bans.delete(ip)
        }
        else {
            let banInfo = await makeDbRequest("exec", {
                stmt: "SELECT startDate, finishDate, reason, userAppeal, appealRejected FROM Bans WHERE userIntId = ?",
                params: intId })
            if (banInfo && banInfo[0]) {
                banInfo = banInfo[0] 
                ws.send(createPunishPacket(PUNISHMENT_STATE.ban, banInfo.startDate,
                    banInfo.finishDate, banInfo.reason, banInfo.userAppeal, banInfo.appealRejected))
            }
            else {
                ws.send(createPunishPacket(PUNISHMENT_STATE.ban, NOW, banFinish, "Unknown", "N/A", true))
            }
        }
    }
    const muteFinish = mutes.get(ip)
    if (muteFinish) {
        if (muteFinish < NOW) {
            mutes.delete(ip)
        }
        else {
            let muteInfo = await makeDbRequest("exec", {
                stmt: "SELECT startDate, finishDate, reason, userAppeal, appealRejected FROM Mutes WHERE userIntId = ?1",
                params: intId })
            if (muteInfo && muteInfo[0]) {
                muteInfo = muteInfo[0]
                ws.send(createPunishPacket(PUNISHMENT_STATE.mute, muteInfo.startDate,
                    muteInfo.finishDate, muteInfo.reason, muteInfo.userAppeal, muteInfo.appealRejected))
            }
            else {
                ws.send(createPunishPacket(PUNISHMENT_STATE.mute, NOW, muteFinish, "Unknown", "N/A", true))
            }
        }
    }
}

const wss = Bun.serve({
    fetch(req, server) {
        const cookies = cookie.parse(req.headers.get("Cookie") || "")
        let newToken = null
        if (!cookies[uidToken]) {
            newToken = randomString(32)
        }
        const url = new URL(req.url)
        server.upgrade(req, {
            data: {
                url: url.pathname.slice(1).trim(),
                headers: req.headers,
                token: cookies[uidToken] || newToken
            },
            headers: {
                ...newToken && {
                    "Set-Cookie": cookie.serialize(uidToken,
                        newToken, {
                            domain: url.hostname,
                            expires: new Date(4e12),
                            httpOnly: true, // Inaccessible from JS
                            sameSite: CORS_COOKIE ? "lax" : "none", // Cross origin
                            secure: SECURE_COOKIE // Only over HTTPS
                        })
                }
            }
        })

        return undefined
    },
    websocket: {
        async open(ws) {
            wss.clients.add(ws)
            if (USE_CLOUDFLARE) ws.data.ip = ws.data.headers.get("cf-connecting-ip")?.split(":", 4).join(":")
            if (!ws.data.ip) ws.data.ip = ws.data.headers.get("x-forwarded-for")?.split(",")[0]?.split(":", 4).join(":")
            if (!ws.data.ip) ws.data.ip = ws.remoteAddress.split(":", 4).join(":")
            if (!ws.data.ip || ws.data.ip.startsWith("%")) return ws.close(4000, "No IP")
            const IP = ws.data.ip
            const URL = ws.data.url
            if (!isUser(IP)) {
                ws.close(4000, "Not user")
                return
            }
            if (USE_CLOUDFLARE && !ORIGINS.includes(ws.data.headers.get("origin"))) return ws.close(4000, "No origin")
            if (BLACKLISTED.has(IP)) return ws.close()
            ws.subscribe("all") // receive all ws messages
            let CD = COOLDOWN
            if (URL) {
                const codeHash = sha256(URL)
                const vip = VIP.get(codeHash)
                if (!vip) {
                    return ws.close(4000, "Invalid VIP code. Please do not try again.")
                }
                const existingVip = activeVips.get(codeHash)
                existingVip?.close(4000, "You have connected with this VIP code on another session.")
                activeVips.set(codeHash, ws)
                ws.data.codeHash = codeHash
                ws.data.perms = vip.perms
                CD = vip.cooldownMs
            }
            ws.data.cd = CD

            if (CAPTCHA && ws.data.perms !== "admin") await forceCaptchaSolve(ws)
            ws.data.lastChat = 0 //last chat
            ws.data.connDate = NOW //connection date

            const buf = Buffer.alloc(9)
            buf[0] = 1
            buf.writeUint32BE(Math.ceil(cooldowns.get(IP) / 1000) || 1, 1)
            buf.writeUint32BE(LOCKED ? 0xFFFFFFFF : ws.data.cd, 5)
            ws.send(buf)
            ws.send(infoBuffer)
            ws.send(runLengthChanges())
        
            // If a custom palette is defined, then we send to client
            if (Array.isArray(PALETTE)) {
                const paletteBuffer = Buffer.alloc(1 + PALETTE.length * 4)
                paletteBuffer[0] = 0
                for (let i = 0; i < PALETTE.length; i++) {
                    paletteBuffer.writeUInt32BE(PALETTE[i], i + 1)
                }
                ws.send(paletteBuffer)
            }
            
            // This section is the only potentially hot DB-related code in the server, investigate optimisatiions
            const pIntId = await makeDbRequest("authenticateUser", { token: ws.data.token, ip: IP })
            ws.data.intId = pIntId
            playerIntIds.set(ws, pIntId)
            const pIdBuf = Buffer.alloc(5)
            pIdBuf.writeUInt8(11, 0) // TODO: Integrate into packet 1
            pIdBuf.writeUInt32BE(pIntId, 1)
            ws.send(pIdBuf)

            if (ws.data.codeHash) {
                dbWorker.postMessage({ call: "updateUserVip",
                    data: { intId: pIntId, codeHash: ws.data.codeHash } })
            }
            await applyPunishments(ws, pIntId, IP)

            const pName = await makeDbRequest("getUserChatName", pIntId)
            if (pName) {
                ws.data.chatName = pName
                playerChatNames.set(ws.data.intId, pName)
            }
            const nmInfoBuf = createNamesPacket(playerChatNames)
            ws.send(nmInfoBuf)
        },
        async message(ws, data) {
            if (typeof data === "string") return
            // Redefine as message handler is now separate from open
            const IP = ws.data.ip
            const CD = ws.data.cd

            switch (data[0]) {
                case 4: { // pixel place
                    if (data.length < 6 || LOCKED === true || toValidate.has(ws) || bans.has(IP)) return
                    const i = data.readUInt32BE(1), c = data[5]
                    if (i >= BOARD.length || c >= PALETTE_SIZE) return
                    const cd = cooldowns.get(IP)
                    if (cd > NOW) {
                        const data = Buffer.alloc(10)
                        data[0] = 7
                        data.writeInt32BE(Math.ceil(cd / 1000) || 1, 1)
                        data.writeInt32BE(i, 5)
                        data[9] = CHANGES[i] == 255 ? BOARD[i] : CHANGES[i]
                        ws.send(data)
                        return
                    }
                    if (checkPreban(i % WIDTH, Math.floor(i / HEIGHT), ws)) return
                    CHANGES[i] = c
                    cooldowns.set(IP, NOW + CD - 500)
                    newPos.push(i)
                    newCols.push(c)
                    if (INCLUDE_PLACER) newIds.push(ws.data.intId)
                    dbWorker.postMessage({ call: "updatePixelPlace", data: ws.data.intId })
                    break
                }
                case 12: { // Submit name
                    let name = decoderUTF8.decode(data.subarray(1))
                    const resName = RESERVED_NAMES.getReverse(name) // reverse = valid code, use reserved name, forward = trying to use name w/out code, invalid
                    name = resName ? resName + "✓" : censorText(name.replace(/\W+/g, "").toLowerCase()) + (RESERVED_NAMES.getForward(name) ? "~" : "")
                    if (!name || name.length > 16) return
    
                    // Update chatNames so new players joining will also see the name and pass to DB
                    ws.data.chatName = name
                    playerChatNames.set(ws.data.intId, name)
                    dbWorker.postMessage({ call: "setUserChatName", data: { intId: ws.data.intId, newName: name }})

                    // Combine with player intId and alert all other clients of name change
                    const encName = encoderUTF8.encode(name)
                    const nmInfoBuf = Buffer.alloc(6 + encName.length)
                    nmInfoBuf.writeUInt8(12, 0)
                    nmInfoBuf.writeUInt32BE(ws.data.intId, 1)
                    nmInfoBuf.writeUInt8(encName.length, 5)
                    nmInfoBuf.set(encName, 6)
                    wss.publish("all", nmInfoBuf)
                    break
                }
                case 13: { // Live chat history
                    const messageId = data.readUint32BE(1)
                    const count = data[5] & 127
                    const before = data[5] >> 7
                    const encChannel = data.subarray(6)
                    const channel = decoderUTF8.decode(encChannel)
                    const messageHistory = await makeDbRequest("getLiveChatHistory", { messageId, count, before, channel })

                    const messages = []
                    const usernames = new Map()
                    let size = 7 + encChannel.byteLength
                    for (const row of messageHistory) {
                        usernames.set(row.senderIntId, row.chatName)
                        const messageData = createChatPacket(0, row.message, Math.floor(row.sendDate / 1000), row.messageId,
                            row.senderIntId, row.channel, row.repliesTo)
                        // We reuse the first two bytes (would be type and packetcode) for length. Could overflow if txt is 100% of the 2 byte max len
                        messageData.writeUint16BE(messageData.byteLength, 0)
                        size += messageData.byteLength
                        messages.push(messageData)
                    }

                    // Client may race between applying intId:name bindings and inserting the new messages w/ usernames. Oof!
                    const nmInfoBuf = createNamesPacket(usernames)
                    ws.send(nmInfoBuf)
                    
                    let i = 0
                    const historyBuffer = Buffer.allocUnsafe(size)
                    historyBuffer[i++] = 13
                    historyBuffer.writeUInt32BE(messageId, i); i += 4
                    historyBuffer[i++] = data[5]
                    historyBuffer[i++] = encChannel.byteLength
                    historyBuffer.set(encChannel, i); i += encChannel.byteLength
                    for (const message of messages) {
                        message.copy(historyBuffer, i, 0, message.byteLength)
                        i += message.byteLength
                    }
                    ws.send(historyBuffer)
                    break
                }
                case 15: { // chat
                    if (ws.data.lastChat + (CHAT_COOLDOWN_MS || 2500) > NOW
                        || data.length > (CHAT_MAX_LENGTH || 400) || bans.has(IP) || mutes.has(IP)) {
                        return
                    }
                    ws.data.lastChat = NOW
    
                    // These may or may not be defined depending on message type
                    let channel = null
                    let positionIndex = null
                    let repliesTo = null
    
                    let offset = 1
                    const type = data.readUInt8(offset++)
                    const msgLength = data.readUInt16BE(offset); offset += 2
                    let message = decoderUTF8.decode(data.subarray(offset, offset + msgLength)); offset += msgLength
                    if (type == 0) { // Live chat message
                        const channelLength = data.readUInt8(offset); offset++
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
                    if (ws.data.perms !== "admin" && ws.data.perms !== "vip" && ws.data.perms !== "chatmod") {
                        message = message.replaceAll("@everyone", "*********")
                        message = message.replaceAll("@here", "*****")
                    }
                    else if (ws.data.perms !== "admin") {
                        message = message.replaceAll("@everyone", "*********")
                    }
                    
                    let messageId = null
                    if (type === 0) {
                        messageId = ++liveChatMessageId
                        dbWorker.postMessage({ call: "insertLiveChat", data: [ messageId,
                            message, NOW, channel, ws.data.intId, repliesTo ] })
                    }
                    else {
                        messageId = ++placeChatMessageId
                        dbWorker.postMessage({ call: "insertPlaceChat", data: [ messageId,
                            message, NOW, ws.data.intId, Math.floor(positionIndex % WIDTH),
                            Math.floor(positionIndex / HEIGHT) ] })
                    }

                    wss.publish("all", createChatPacket(type, message, Math.floor(NOW / 1000), messageId, ws.data.intId,
                        channel, repliesTo, positionIndex))

                    if (!CHAT_WEBHOOK_URL) break
                    try {
                        const hookName = ws.data.chatName?.replaceAll("@", "@​")
                        const hookChannel = channel?.replaceAll("@", "@​")
                        const hookMessage = message.replaceAll("@", "@​")
                        const msgHook = { username: `[${hookChannel || "place chat"}] ${hookName || "anon"} @rplace.live`, content: hookMessage }
                        fetch(CHAT_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
                    }catch (err){ console.log("Could not post chat message to discord: " + err) }        
                    break
                }
                case 16: {
                    const response = data.subarray(1).toString()
                    const info = toValidate.get(ws)
                    if (info && response === info.answer && info.start + CAPTCHA_EXPIRY_SECS * 1000 > NOW) {
                        captchaFailed.delete(IP)
                        toValidate.delete(ws)
                        const dv = new DataView(new ArrayBuffer(2))
                        dv.setUint8(0, 16)
                        ws.send(dv)
                    }
                    else {
                        const prev = captchaFailed.get(IP)
                        // Block bots attempting to bruteforce captcha quickly
                        if (prev && NOW - prev.last < CAPTCHA_MIN_MS) prev.fails += 3
                        const info = { fails: (prev?.fails || 0) + 1, last: NOW }
                        captchaFailed.set(IP, info)
                        const acceptableFails = 6 // TODO: Math.min(zcaptcha.config.dummiesCount / 2, 10)
                        if (info.fails < acceptableFails) return ws.close()
                        const banLengthS = (info.fails - acceptableFails + 1) ** 2 * 60
                        ban(ws.data.intId, banLengthS)
                        modWebhookLog(`Client **${IP}** **banned** by server for **${banLengthS
                            }** seconds for failing captcha **${info.fails}** times`)
                    }
                    break
                }
                case 20: {
                    ws.data.voted ^= 1 << data[1]
                    if (ws.data.voted & (1 << data[1])) VOTES[data[1] & 31]++
                    else VOTES[data[1] & 31]--
                    break
                }
                case 96: {// Set preban
                    let offset = 1
                    if (ws.data.perms !== "admin" && ws.data.perms !== "canvasmod") return
                    const violation = data[offset++] // 0 - kick, 1 - ban, 2 - nothing (log)
                    const startI = data.readUint32BE(offset); offset += 4
                    const endI = data.readUint32BE(offset); offset += 4
                    const x1 = startI % WIDTH
                    const y1 = Math.floor(startI / WIDTH)
                    const x2 = endI % WIDTH
                    const y2 = Math.floor(endI / WIDTH)

                    modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **set preban area** from (${
                        x1}, ${y1}) to (${x2}, ${y2}), with violation action ${["kick", "ban", "none"][violation]}`)
                    break
                }
                case 98: { // User moderation
                    if (ws.data.perms !== "admin" && ws.data.perms !== "chatmod") return
                    let offset = 1
                    const action = data[offset++]
    
                    switch (action) {
                        case 0: { // Kick
                            const actionIntId = data.readUInt32BE(offset); offset += 4
                            const actionReason = data.slice(offset, Math.min(data.byteLength, 300 + offset)).toString()
                            if (actionReason.length == 0) return

                            let actionCli = null
                            for(const [p, uid] of playerIntIds) {
                                if (uid === actionIntId) actionCli = p
                            }
                            if (actionCli === null) return
        
                            if (action == 0) { // kick
                                modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **kick** user **${
                                    actionCli.data.ip}**, with reason: '${
                                    actionReason.replaceAll("@", "@​")}'`)
                                actionCli.close()
                            }
                            break
                        }
                        case 1: // Mute
                        case 2: { // Ban
                            const actionIntId = data.readUInt32BE(offset); offset += 4
                            const actionTimeS = data.readUInt32BE(offset); offset += 4
                            const actionReason = data.slice(offset, Math.min(data.byteLength, 300 + offset)).toString()
                            if (actionReason.length == 0) return

                            let actionCli = null
                            for(const [p, uid] of playerIntIds) {
                                if (uid === actionIntId) actionCli = p
                            }
                            if (actionCli == null) return
        
                            modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **${["mute", "ban"][action - 1]
                                }** user **${actionCli.data.ip}**, for **${actionTimeS}** seconds, with reason: '${
                                actionReason.replaceAll("@", "@​")}'`)
        
                            if (action == 1) mute(actionIntId, actionTimeS, actionReason, ws.data.intId)
                            else ban(actionIntId, actionTimeS, actionReason, ws.data.intId)
                            break
                        }
                        case 3: { // Force captcha revalidation
                            const actionIntId = data.readUInt32BE(offset); offset += 4
                            const actionReason = data.subarray(offset, Math.min(data.byteLength, 300 + offset)).toString()
                            if (actionReason.length == 0) return
                            let actionCli = null
        
                            if (actionIntId !== 0) {
                                for(const [p, uid] of playerIntIds) {
                                    if (uid === actionIntId) actionCli = p
                                }
                                if (actionCli == null) return
        
                                await forceCaptchaSolve(actionCli)
                            }
                            else {
                                for (const c of wss.clients) {
                                    forceCaptchaSolve(c)
                                }
                            }
                            
                            modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **force captcha revalidation** for ${
                                actionIntId === 0 ? "**__all clients__**" : ("user **" + actionCli.data.ip + "**")}, with reason: '${
                                actionReason.replaceAll("@", "@​")}'`)    
                            break
                        }
                        case 4: { // Delete chat message
                            const actionMsgId = data.readUInt32BE(offset); offset += 4
                            const actionReason = data.subarray(offset, Math.min(data.byteLength, 300 + offset)).toString()
                            if (actionMsgId === 0 || actionReason.length == 0) return

                            dbWorker.postMessage({ call: "deleteLiveChat", data: {
                                messageId: actionMsgId,
                                reason: actionReason,
                                moderatorIntId: ws.data.intId }})

                            const deleteBuf = Buffer.allocUnsafe(9)
                            deleteBuf[0] = 17
                            deleteBuf.writeUInt32BE(actionMsgId, 1)
                            wss.publish("all", deleteBuf)

                            modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **delete chat message** with id ${actionMsgId
                                }, with reason: '${actionReason.replaceAll("@", "@​")}'`)
                            break
                        }
                    }
                    break
                }
                case 99: {
                    if (ws.data.perms !== "admin" && ws.data.perms !== "canvasmod") return
                    const w = data[1]
                    let i = data.readUInt32BE(2)
                    const h = Math.floor((data.length - 6) / w)
                    if (i % WIDTH + w >= WIDTH || i + h * HEIGHT >= WIDTH * HEIGHT) return
    
                    let hi = 6
                    const target = w * h + 6
    
                    while (hi < target) {
                        CHANGES.set(data.subarray(hi, hi + w), i)
                        i += WIDTH
                        hi += w
                    }

                    modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **rollback area** at (${
                        i % WIDTH}, ${Math.floor(i / WIDTH)}), ${w}x${h}px (${w * h} pixels changed)`)
                    break
                }
            }    
        },
        async close(ws, code, message) {
            playerChatNames.delete(ws.data.intId)
            playerIntIds.delete(ws)
            toValidate.delete(ws)
            activeVips.delete(ws.data.codeHash)
            dbWorker.postMessage({ call: "exec", data: {
                stmt: "UPDATE Users SET playTimeSeconds = playTimeSeconds + ?1 WHERE intId = ?2",
                params: [ Math.floor((NOW - ws.data.connDate) / 1000), ws.data.intId ] } })
            wss.clients.delete(ws)
        },
        perMessageDeflate: false,
    },
    port: PORT,
    ...SECURE && {
        tls: {
            // Path to certbot certificate, i.e: etc/letsencrypt/live/server.rplace.tk/fullchain.pem,
            // Path to certbot key, i.e: etc/letsencrypt/live/server.rplace.tk/privkey.pem
            cert: Bun.file(CERT_PATH),
            key: Bun.file(KEY_PATH)
        }
    },
})
wss.clients = new Set() // Hack for compatibility with old node code

async function modWebhookLog(message) {
    console.log(message)
    if (!MOD_WEBHOOK_URL) return
    message = message.replace("@", "@​")
    const msgHook = { username: "RPLACE SERVER", content: message }
    await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
}

let NOW = Date.now()
setInterval(() => {
    NOW = Date.now()
}, 50)

zcaptcha.init()
let currentCaptcha = zcaptcha.genTextCaptcha // zcaptcha.genEmojiCaptcha

/**
 * Force a client to redo the captcha
 * @param {string|number|import('bun').ServerWebSocket<any>} identifier - String client ip address, intId or client websocket instance
 */
async function forceCaptchaSolve(identifier) {
	const cli = identifier
    if (typeof identifier === "number") {
        for (const cli of wss.clients) { 
            if (cli.data.intId == identifier) {
                cli.close()
            }
        }
    }
    else if (typeof identifier === "string") {
        for (let cli of wss.clients) {
            if (cli.data.ip === identifier) cli = identifier
        }
    }
    if (!cli || typeof cli != "object") return

    try {
        const result = currentCaptcha()
        if (!result) return cli.close()
        const encodedDummies = encoderUTF8.encode(result.dummies)

        toValidate.set(cli, { start: NOW, answer: result.answer })
        const dv = new DataView(new ArrayBuffer(3 + encodedDummies.byteLength + result.data.byteLength))
        if (currentCaptcha == zcaptcha.genTextCaptcha)
            dv.setUint8(0, 18)
        else if (currentCaptcha == zcaptcha.genMathCaptcha)
            dv.setUint8(0, 19)
        else if (currentCaptcha == zcaptcha.genEmojiCaptcha)
            dv.setUint8(0, 20)
        else
            throw new Error("Could not run captcha func - Specified Captcha doesn't exist")
        dv.setUint8(1, encodedDummies.byteLength)

        const dataArray = new Uint8Array(result.data)
        const dvArray = new Uint8Array(dv.buffer)
        dvArray.set(encodedDummies, 2)
        dvArray.set(dataArray, 2 + encodedDummies.byteLength)
        cli.send(dv)
    }
    catch (e) {
        console.error(e)
        cli.close()
    }
}

async function pushImage() {
    for (let i = BOARD.length - 1; i >= 0; i--) { if (CHANGES[i] != 255) BOARD[i] = CHANGES[i] }

    await Bun.write(path.join(PUSH_PLACE_PATH, "place"), BOARD)
	await fs.unlink(path.join(PUSH_PLACE_PATH, ".git/index.lock")).catch(_ => { })
    const addResult = await $`git add -A`.cwd(PUSH_PLACE_PATH).quiet()
    if (addResult.exitCode != 0 && addResult.stderr) {
        console.error("Failed to push canvas backup image (failure during git add)\n", addResult.stderr.toString())
    }
    const pushResult = await $`git commit -a -m 'Canvas backup'; git push --force ${PUSH_LOCATION}`.cwd(PUSH_PLACE_PATH).quiet()
    if (pushResult.exitCode != 0 && pushResult.stderr) {
        console.error("Failed to push canvas backup image (fail during push)\n", pushResult.stderr.toString())
    }
    else {
        // [If sucesssful push] Serve old changes for 11 more mins before wipe just to be 100% safe
        // of slow git sync or http canvas file server caching...
        const curr = new Uint8Array(CHANGES)
        setTimeout(() => {
            // After 11 minutes, remove all old changes. Where there is a new change, curr[i] != CHANGES[i] and so it will be kept, but otherwise, remove
            for (let i = curr.length - 1; i >= 0; i--) { if (curr[i] == CHANGES[i]) CHANGES[i] = 255 }
        }, 200e3)
    }
}

let captchaTick = 0
setInterval(function () {
    fs.appendFile("./pxps.txt", "\n" + newPos.length + "," + NOW)
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
        if (INCLUDE_PLACER) {
            buf.writeInt32BE(newIds.pop(), i)
            i += 4
        }
    }
    wss.publish("all", buf)

    // Captcha tick
    if (captchaTick % CAPTCHA_EXPIRY_SECS == 0) {
        for (const [c, info] of toValidate.entries()) {
            if (info.start + CAPTCHA_EXPIRY_SECS * 1000 < NOW) {
                c.close()
                toValidate.delete(c.data.ip)
            }
        }

        // How long before the server will forget their captcha fails
        for (const [ip, info] of captchaFailed.entries()) {
            if (info.last + 2 ** info.fails < NOW) captchaFailed.delete(ip)
        }
    }
    captchaTick++
}, 1000)

let pushTick = 0
const infoBuffer = Buffer.alloc(131)
infoBuffer[0] = 3
setInterval(async function () {
    pushTick++
    infoBuffer[1] = (realPlayers + playersOffset) >> 8
    infoBuffer[2] = realPlayers + playersOffset
    for (let i = 0; i < VOTES.length; i++) {
        infoBuffer.writeUint32BE(VOTES[i], (i << 2) + 3)
    }
    wss.publish("all", infoBuffer)

    fs.appendFile("./stats.txt", "\n" + realPlayers + "," + NOW)
    if (LOCKED === true) return
    await fs.writeFile(path.join(PUSH_PLACE_PATH, "change" + (pushTick & 1 ? "2" : "")), CHANGES)
    if (pushTick % (PUSH_INTERVAL_MINS / 5 * 60) == 0) {
        try {
            await pushImage()
            await fs.writeFile("./votes", VOTES)
        } catch (e) {
            console.log("[" + new Date().toISOString() + "] Error pushing image", e)
        }
        for (const [k, t] of cooldowns) {
            if (t > NOW) cooldowns.delete(k)
        }
    }
}, 5000)

repl("|place$ ", input => console.log(eval(input)))

/**
 * Fill given canvas area with certain colour
 * @param {number} x - Start X of region
 * @param {number} y - Start Y of region
 * @param {number} x1 - End X of region
 * @param {number} y1 - End Y of region
 * @param {number} x - Int colour code index to be used
 * @param {boolean} random - Fill with random colours instead
 */
function fill(x, y, x1, y1, c = 27, random = false) {
    let w = x1 - x, h = y1 - y
    for (; y < y1; y++) {
        for (; x < x1; x++) {
            CHANGES[x + y * WIDTH] = random ? Math.floor(Math.random() * 24) : c
        }
        x = x1 - w
    }

    return `Filled an area of ${w}*${h} (${(w * h)} pixels), reload the game to see the effects`
}

/** @typedef {("kick"|"ban"|"blacklist"|"none"|(function(import('bun').ServerWebSocket, number, number): boolean))} PrebanAction */
/**
 * @typedef {Object} PrebanArea
 * @property {number} x - The x-coordinate.
 * @property {number} y - The y-coordinate.
 * @property {number} x1 - The x-coordinate of the other corner.
 * @property {number} y1 - The y-coordinate of the other corner.
 * @property {PrebanAction} action - The action to be performed on catch
 */
/** @type {PrebanArea} */
const prebanArea = { x: 0, y: 0, x1: 0, y1: 0, action: "kick" }
/**
 * This function is intended to allow us to ban any contributors to a heavily botted area (most likely botters)
 * by banning them as soon as we notice them placing a pixel in such area.
 * @param {number} _x - x start
 * @param {number} _y - y start
 * @param {number} _x1 - x end
 * @param {number} _y1 - y end
 * @param {PrebanAction} _action - The action to be performed on catch
 */
function setPreban(_x, _y, _x1, _y1, _action = "kick") {
    prebanArea.x = _x; prebanArea.y = _y; prebanArea.x1 = _x1; prebanArea.y1 = _y1; prebanArea.action = _action
}
function clearPreban() {
    prebanArea.x = 0; prebanArea.y = 0; prebanArea.x1 = 0; prebanArea.y1 = 0; prebanArea.action = "kick"
}
function checkPreban(incomingX, incomingY, p) {
    if (prebanArea.x == 0 && prebanArea.y == 0 && prebanArea.x1 == 0 && prebanArea.y1 == 0) return false
    if ((incomingX > prebanArea.x && incomingX < prebanArea.x1) && (incomingY > prebanArea.y && incomingY < prebanArea.y1)) {
        modWebhookLog(`Pixel placed in preban area at ${incomingX}, ${incomingY} by ${p.ip}`)

        if (typeof prebanArea.action === "function") {
            return prebanArea.action(p, incomingX, incomingY)
        }
        switch(prebanArea.action) {
            case "blacklist":
                blacklist(p.data.ip)
                return true
            case "ban":
                ban(p.data.intId, 0xFFFFFFFF / 1000, "Violating canvas preban")
                return true
            case "kick":
                p.close()
                return true
            case "none":
                return true
        }
    }

    return false
}

/**
 * Softban a client using their intId for a finite amount of time
 * @param {number} intId - Integer id of client that is to be banned
 * @param {number} duration - Integer duration (seconds) for however long this client will be muted for
 * @param {string?} reason - String reason for which client is being muted
 * @param {number?} modIntId - Responsible moderator integer ID 
*/
async function ban(intId, duration, reason = null, modIntId = null) {
    const start = NOW
    const finish = start + duration * 1000
    const banDbData = {
        stmt: "INSERT OR REPLACE INTO Bans (startDate, finishDate, userIntId, moderatorIntId, " +
            "reason, userAppeal, appealRejected) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params: [ start, finish, intId, modIntId, reason, null, 0 ] }
    dbWorker.postMessage({ call: "exec", data: banDbData })
    
    const ips = await makeDbRequest("exec", {
        stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?1", params: intId })
    for (const ipObject of ips) {
        bans.set(ipObject.ip, finish)
    }
}

/**
 * Mute a client using their intId for a finite amount of time
 * @param {number} intId - Integer id of client that is to be muted
 * @param {number} duration - Integer duration (seconds) for however long this client will be muted for
 * @param {string?} reason - String reason for which client is being muted
 * @param {number?} modIntId - Responsible moderator integer ID 
 */
async function mute(intId, duration, reason = null, modIntId = null) {       
    const start = NOW
    const finish = start + duration * 1000
    const muteDbData = {
        stmt: "INSERT OR REPLACE INTO Mutes (startDate, finishDate, userIntId, moderatorIntId," +
            "reason, userAppeal, appealRejected) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params: [ start, finish, intId, modIntId, reason, null, 0 ] }
    dbWorker.postMessage({ call: "exec", data: muteDbData })

    const ips = await makeDbRequest("exec", { stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?", params: intId })
    for (const ipObject of ips) {
        mutes.set(ipObject.ip, finish)
    }
}

/**
 * Permanment IP block a player by IP, via WS instance or via intID
 * @param {string|import('bun').ServerWebSocket<any>|number} identifier IP/WS Instance/intID
 */
function blacklist(identifier) {
    let ip = null
    if (typeof identifier === "number") {
        for (const cli of wss.clients) { 
            if (cli.data.intId == identifier) {
                ip = cli.data.ip
                cli.close()
            }
        }
    }
    else if (typeof identifier === "string") {
        ip = identifier
        for (const p of wss.clients) {
            if (p.data.ip === ip) p.close()
        }
    }
    else if (identifier instanceof Object) {
        const cli = identifier
        cli.close()
        ip = cli.data.ip
    }
    if (!ip) return

    BLACKLISTED.add(ip)
    fs.appendFile("./blacklist.txt", "\n" + ip)
}

/**
 * Broadcast a message as the server to a specific client (p) or all players, in a channel
 * @param {string} msg - Message being sent
 * @param {string} channel - Channel message could be sent in
 * @param {import('bun').ServerWebSocket<any>?} p - WS instance message is being sent to
 * @param {number?} repliesTo - Integer id message being replied to 
 */
function announce(msg, channel, p = null, repliesTo = null) {
    const packet = createChatPacket(0, msg, Math.floor(NOW / 1000), 0, 0, channel, repliesTo)
    if (p != null) p.send(packet)
    else for (const c of wss.clients) c.send(packet)
}

let shutdown = false
process.on("uncaughtException", console.warn)
process.on("SIGINT", function () {
    if (shutdown) {
        console.log("Bruh impatient")
        process.exit(0)
    }
    else {
        shutdown = true
        process.stdout.write("\rShutdown received. Wait a sec");

        (async function() {
            await makeDbRequest("commitShutdown")
            console.log("\rBye-bye!                             ")
            process.exit(0)
        })()
    }
})

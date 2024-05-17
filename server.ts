/* eslint-disable jsdoc/require-param */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-check
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-jsdoc */
// Legacy rplace server software, (c) BlobKat, Zekiah
// For the current server software, go to https://github.com/Zekiah-A/RplaceServer
import { promises as fs } from "fs"
import sha256 from "sha256"
import fsExists from "fs.promises.exists"
import fetch from "node-fetch"
import util from "util"
import path from "path"
import * as zcaptcha from './zcaptcha/server.ts'
import { isUser } from "ipapi-sync"
import { Worker } from "worker_threads"
import cookie from "cookie"
import repl from "basic-repl"
import { $, Server, ServerWebSocket, TLSWebSocketServeOptions } from "bun"
import { DbInternals, LiveChatMessage } from "./db-worker.ts"
import { PublicPromise } from "./server-types.ts"

let BOARD:Uint8Array, CHANGES:Uint8Array, VOTES:Uint32Array

type ServerConfig = {
    "SECURE": boolean,
    "CERT_PATH": string,
    "KEY_PATH": string,
    "PORT": number,
    "WIDTH": number,
    "HEIGHT": number,
    "COOLDOWN": number,
    "CAPTCHA": boolean,
    "PXPS_SECURITY": boolean,
    "PALETTE": number[]|null,
    "USE_CLOUDFLARE": boolean,
    "PUSH_LOCATION": string,
    "PUSH_PLACE_PATH": string,
    "LOCKED": boolean,
    "CHAT_WEBHOOK_URL": string,
    "MOD_WEBHOOK_URL": string,
    "CHAT_MAX_LENGTH": number,
    "CHAT_COOLDOWN_MS": number,
    "PUSH_INTERVAL_MINS": number,
    "CAPTCHA_EXPIRY_SECS": number,
    "PERIODIC_CAPTCHA_INTERVAL_SECS": number,
    "LINK_EXPIRY_SECS": number,
    "CAPTCHA_MIN_MS": number, //min solvetime
    "INCLUDE_PLACER": boolean, // pixel placer
    "SECURE_COOKIE": boolean,
    "CORS_COOKIE": boolean,
    "CHALLENGE": boolean,
    "TURNSTILE": boolean,
    "TURNSTILE_SITE_KEY": string,
    "TURNSTILE_PRIVATE_KEY": string
}
let configFailed = false
let configFile = await fs.readFile("./server_config.json").catch(_ => configFailed = true)
if (configFailed) {
    await fs.writeFile("server_config.json", JSON.stringify({
        "SECURE": true,
        "CERT_PATH": "/etc/letsencrypt/live/path/to/fullchain.pem",
        "KEY_PATH": "/etc/letsencrypt/live/server.rplace.live/fullchain.pem",
        "PORT": 443,
        "WIDTH": 2000,
        "HEIGHT": 2000,
        "COOLDOWN": 1000,
        "CAPTCHA": false,
        "PXPS_SECURITY": false,
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
        "PERIODIC_CAPTCHA_INTERVAL_SECS": -1,
        "LINK_EXPIRY_SECS": 60,
        "CAPTCHA_MIN_MS": 100, //min solvetime
        "INCLUDE_PLACER": false, // pixel placer
        "SECURE_COOKIE": true,
        "CORS_COOKIE": false,
        "CHALLENGE": false,
        "TURNSTILE": false,
        "TURNSTILE_SITE_KEY": "",
        "TURNSTILE_PRIVATE_KEY": ""    
    }, null, 4))
    console.log("Config file created, please update it before restarting the server")
    process.exit(0)
}

// TODO: Maybe make config
let { SECURE, CERT_PATH, PORT, KEY_PATH, WIDTH, HEIGHT, PALETTE, COOLDOWN, CAPTCHA,
    PXPS_SECURITY, USE_CLOUDFLARE, PUSH_LOCATION, PUSH_PLACE_PATH, LOCKED, CHAT_WEBHOOK_URL, MOD_WEBHOOK_URL,
    CHAT_MAX_LENGTH, CHAT_COOLDOWN_MS, PUSH_INTERVAL_MINS, CAPTCHA_EXPIRY_SECS, PERIODIC_CAPTCHA_INTERVAL_SECS,
    LINK_EXPIRY_SECS, CAPTCHA_MIN_MS, INCLUDE_PLACER, SECURE_COOKIE, CORS_COOKIE, CHALLENGE,
    TURNSTILE, TURNSTILE_SITE_KEY, TURNSTILE_PRIVATE_KEY } = JSON.parse(configFile.toString()) as ServerConfig

try { BOARD = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "place")).arrayBuffer()) }
catch(e) { BOARD = new Uint8Array(WIDTH * HEIGHT) }
try { CHANGES = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "change")).arrayBuffer()) }
catch(e) { CHANGES = new Uint8Array(WIDTH * HEIGHT).fill(255) }
try { VOTES = new Uint32Array(await Bun.file("./votes").arrayBuffer()) }
catch(e) { VOTES = new Uint32Array(32) }
let uidTokenFailed = false
const uidTokenFile = await fs.readFile("uidtoken.txt").catch(_ => uidTokenFailed = true)
let uidToken:string
if (uidTokenFile == null || uidTokenFailed) {
    uidToken = "UidToken_" + Math.random().toString(36).slice(2)
    await fs.writeFile("uidtoken.txt", uidToken)
}
else {
    uidToken = uidTokenFile.toString()
}

let padlock:any = null
if (CHALLENGE) {
    const padlockPath = "./padlock/server.ts"
    const padlockSource = Bun.file(padlockPath)
    if (padlockSource.size !== 0) {
        padlock = await import(padlockPath)
    }
    else {
        throw new Error("Could not enable challenge, challenge module not found")
    }
}

type PixelInfo = { index: number, colour: number, placer: ServerWebSocket<ClientData> }
const newPixels:PixelInfo[] = [] 
// Reports must persist between client sessions and be rate limited
let reportCooldownMs = 60_000
const reportCooldowns = new Map<string, number>()
let activityCooldownMs = 10_000 
const activityCooldowns = new Map<string, number>()
// Cooldowns must persist between client sessions
const cooldowns = new Map<string, number>()
type LinkKeyInfo = {
    intId: number,
    dateCreated: number
}
const linkKeyInfos = new Map<string, LinkKeyInfo>()

/*
 * Compress CHANGES with variable run length encoding
 */
function runLengthChanges() {
    let changesIndex = 0
    let buffers = [Buffer.alloc(256)]
    let bufferIndex = 0
    let bufferPointer = 0
    buffers[0][bufferPointer++] = 2
    buffers[0].writeUint32BE(WIDTH, 1)
    buffers[0].writeUint32BE(HEIGHT, 5)
    bufferPointer += 8

    function addToBuffer(value:number) {
        buffers[bufferIndex][bufferPointer++] = value
        if (bufferPointer === 256) {
            bufferPointer = 0
            buffers.push(Buffer.alloc(256))
            bufferIndex++
        }
    }
    while (true) {
        let blankCells = 0
        while (CHANGES[changesIndex] == 255) {
            blankCells++
            changesIndex++
        }
        if (changesIndex == CHANGES.length) {
            break
        }
        // Two bits are used to store blank cell count
        // 00 = no gap
        // 01 = 1-byte (Gaps up to 255)
        // 10 = 2-byte (Gaps up to 65535)
        // 11 = 4-byte (Likely unused)
        if (blankCells < 256) {
            if(!blankCells){
                addToBuffer(CHANGES[changesIndex++])
            }
            else{
                addToBuffer(CHANGES[changesIndex++] + 64)
                addToBuffer(blankCells)
            }
        }
        else if (blankCells < 65536) {
            addToBuffer(CHANGES[changesIndex++] + 128)
            addToBuffer(blankCells >> 8)
            addToBuffer(blankCells)
        }
        else {
            addToBuffer(CHANGES[changesIndex++] + 192)
            addToBuffer(blankCells >> 24)
            addToBuffer(blankCells >> 16)
            addToBuffer(blankCells >> 8)
            addToBuffer(blankCells)
        }
    }
    buffers[bufferIndex] = buffers[bufferIndex].subarray(0, bufferPointer)
    return Buffer.concat(buffers)
}

/** Bidirectional map */
class DoubleMap<T, K> {
    foward: Map<T, K>
    reverse: Map<K, T>
    constructor() {
        this.foward = new Map<T, K>()
        this.reverse = new Map<K, T>()
    }
    set(key: T, value: K) {
        this.foward.set(key, value)
        this.reverse.set(value, key)
    }
    getForward(key: T) { return this.foward.get(key) }
    getReverse(value: K) { return this.reverse.get(value) }
    delete(key: T):boolean {
        const value = this.foward.get(key)
        if (value) {
            this.foward.delete(key)
            this.reverse.delete(value)
            return true
        }
        return false
    }
    clear() { this.foward.clear(); this.reverse.clear() }
    size() { return this.foward.size }
}

const criticalFiles = ["blacklist.txt", "webhook_url.txt", "bansheets.txt", "mutes.txt", "vip.txt", "reserved_names.txt"]
for (let i = 0; i < criticalFiles.length; i++) {
    if (!await fsExists(criticalFiles[i])) await fs.writeFile(criticalFiles[i], "")
}

/**
 * @param {number} length Length of generated random string
 * @returns {string} random string
 */
function randomString(length: number) {
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
Object.defineProperty(globalThis, "players", {
    // @ts-ignore
    get: function() { return realPlayers + playersOffset },
    // @ts-ignore
    set: function(value) { playersOffset = value - realPlayers }
})

const RESERVED_NAMES = new DoubleMap()
// `reserved_name private_code\n`, for example "zekiah 124215253113\n"
const reservedLines = ((await fs.readFile("reserved_names.txt")).toString()).split('\n')
for (const pair of reservedLines) RESERVED_NAMES.set(pair.split(' ')[0], pair.split(' ')[1])

/**
 * Retrieves blacklisted IP addresses from banlists.txt
 * @returns {Promise<Set<string>>} A Promise that resolves to a Set of blacklisted IP addresses.
 */
async function getBansheetsIps() {
    const bansheetsText = await fs.readFile("bansheets.txt")
    const banListUrls = bansheetsText.toString().trim().split('\n')
    const banLists = await Promise.all(
        banListUrls.map(banListUrl => fetch(banListUrl)
            .then((response: Response) => response.text()))
    )
    const blacklistedIps = banLists
        .flatMap((line: string) => line.trim().split('\n')
        .map((ip: string) => ip.split(':')[0].trim()))
    return new Set(blacklistedIps)
}
let BLACKLISTED = await getBansheetsIps()
for (const ban of (await fs.readFile("blacklist.txt")).toString().split('\n')) {
    BLACKLISTED.add(ban)
}

const toValidate = new Map()
const captchaFailed = new Map()
const encoderUTF8 = new util.TextEncoder()
const decoderUTF8 = new util.TextDecoder()

let dbReqId = 0
const dbReqs = new Map()
const dbWorker = new Worker("./db-worker.ts")

/*
 * __Always await this__, and only use in cases where you __WANT the response__, if you want something that
 * you can just fire and forget then use postDbMessage instead, which does not result in a dbReq allocation
 */
//@ts-expect-error Chicanery (trust me bro)
async function makeDbRequest<T extends DbInternals>(messageCall: keyof T, args?: Parameters<T[keyof T]>[0]): Promise<Awaited<ReturnType<T[keyof T]>>> {
    const handle = dbReqId++
    const promise = new PublicPromise()

    const postCall = { call: messageCall, data: args, handle: handle }
    dbReqs.set(handle, promise)
    dbWorker.postMessage(postCall)
    //@ts-expect-error Chicanery (trust me bro)
    return await promise.promise
}
dbWorker.on("message", (message) => {
    dbReqs.get(message.handle)?.resolve(message.data)
})
dbWorker.on("error", console.warn)
//@ts-expect-error Chicanery (trust me bro)
function postDbMessage<T extends DbInternals>(messageCall: keyof T, args?: Parameters<T[keyof T]>[0]):void {
    dbWorker.postMessage({ call: messageCall, data: args })
}

const playerIntIds = new Map<ServerWebSocket<ClientData>, number>() // Player ws instance<Object> : intID<Number>
const playerChatNames = new Map<number, string>() // intId<Number> : chatName<String>
let liveChatMessageId:number = (await makeDbRequest("getMaxLiveChatId")) as number || 0
let placeChatMessageId:number = (await makeDbRequest("getMaxPlaceChatId")) as number || 0
const mutes = new Map<string, number>() // IP : finishDate (unix epoch offset ms)
const bans = new Map<string, number>() // IP : finishDate (unix epoch offset ms)
const activeVips = new Map<string, ServerWebSocket<ClientData>>() // String VIP key : client

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

type VipEntry = {
    perms: "admin"|"chatmod"|"vip",
    cooldownMs: number
}
function readVip(vipTxt: string):Map<string, VipEntry> {
    return new Map(vipTxt
        .split('\n')
        .filter((/** @type {string} */ line) => line.trim() && !line.trim().startsWith('#'))
        .map((/** @type {string} */ pair) => [ pair.trim().slice(0, 64), JSON.parse(pair.slice(64).trim()) ]))
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
            for (const [k, _] of removedKeys) {
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
const muteIdFinishes:any = await makeDbRequest("exec", {
    stmt: "SELECT userIntId AS intId, finishDate FROM Mutes WHERE finishDate > ?",
    params: Date.now() })
for (const idFinish of muteIdFinishes) {
    const idIps:any = await makeDbRequest("exec", {
        stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?",
        params: idFinish.intId })
    for (const ipObject of idIps) {
        mutes.set(ipObject.ip, idFinish.finishDate)
    }
}
const banIdFinishes:any = await makeDbRequest("exec", {
    stmt: "SELECT userIntId AS intId, finishDate FROM Bans WHERE finishDate > ?",
    params: Date.now() })
for (const idFinish of banIdFinishes) {
    const idIps:any = await makeDbRequest("exec", {
        stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?",
        params: idFinish.intId })
    for (const ipObject of idIps) {
        bans.set(ipObject.ip, idFinish.finishDate)
    }
}

// Server is player ID 0, all server messages have message ID 0
playerChatNames.set(0, "SERVER@RPLACE.LIVE✓")

const allowed = new Set(["rplace.tk", "rplace.live", "discord.gg", "twitter.com", "wikipedia.org", "pxls.space", "reddit.com"])
/**
 *
 * @param {string} text Input text to be sanitised
 * @returns {string} sanitised string
 */
function censorText(text:string) {
    return text
        .replace(/(sik[ey]rim|orospu|piç|yavşak|kevaşe|ıçmak|kavat|kaltak|götveren|amcık|amcık|[fF][uU][ckr]{1,3}(\\b|ing\\b|ed\\b)?|shi[t]|c[u]nt|((n|i){1,32}((g{2,32}|q){1,32}|[gq]{2,32})[e3r]{1,32})|bastard|b[i1]tch|blowjob|clit|c[o0]ck|cunt|dick|(f[Aa4][g6](g?[oi]t)?)|jizz|lesbian|masturbat(e|ion)|nigga|卐|卍|whore|porn|pussy|r[a4]pe|slut|suck)/gi,
            match => "*".repeat(match.length))
        .replace(/https?:\/\/(\w+\.)+\w{2,15}(\/\S*)?|(\w+\.)+\w{2,15}\/\S*|(\w+\.)+(tk|ga|gg|gq|cf|ml|fun|xxx|webcam|sexy?|tube|cam|p[o]rn|adult|com|net|org|online|ru|co|info|link)/gi,
            match => allowed.has(match.replace(/^https?:\/\//, "").split("/")[0]) ? match : "")
        .trim()
}

/**
 * @param {number} type - (0|1) message type (0 - Live chat message, 1 - place chat message)
 * @param {string} message - Message text content (maxlen(65534))
 * @param {number} sendDate - Unix epoch offset __**seconds**__ of message send
 * @param {number} messageId - Message integer id (u32)
 * @param {number} intId - Sender integer id (u32)
 * @param {string?} channel - String channel (maxlen(16))
 * @param {number?} repliesTo - Integer message id replies to (u32)
 * @param {number?} positionIndex - Index on canvas of place chat message (u32)
 * @returns {Buffer} Message packet data prepended with packet code (15)
 */
function createChatPacket(type: number, message: string, sendDate: number, messageId: number, intId: number, channel: string|null = null, repliesTo: number|null = null, positionIndex: number|null = null): Buffer {
    let encodedChannel:Uint8Array|null = null
    if (channel) encodedChannel = encoderUTF8.encode(channel)
    const encodedTxt = encoderUTF8.encode(message)
    const msgPacket = Buffer.allocUnsafe(encodedTxt.byteLength +
        (type == 0 ? 18 + (encodedChannel?.byteLength || 0) + (repliesTo == null ? 0 : 4) : 16))

    let i = 0
    msgPacket[i] = 15; i++
    msgPacket[i] = type; i++
    msgPacket.writeUInt32BE(messageId, i); i += 4
    msgPacket.writeUInt16BE(encodedTxt.byteLength, i); i += 2
    msgPacket.set(encodedTxt, i); i += encodedTxt.byteLength
    msgPacket.writeUInt32BE(intId, i); i +=  4

    if (type == 0 && encodedChannel != null) { // Live chat message
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
    else if (positionIndex != null) { // Place (canvas chat message)
        msgPacket.writeUInt32BE(positionIndex, i); i += 4
    }

    return msgPacket
}

/**
 *
 * @param {Map<number, string>} names IntId : String names map to be encoded
 * @returns {Buffer} Name packet data prepended with packet code (12)
 */
function createNamesPacket(names: Map<number, string>) {
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
function createPunishPacket(type: typeof PUNISHMENT_STATE.mute | typeof PUNISHMENT_STATE.ban, startDate: number, finishDate: number, reason: string, userAppeal: string, appealRejected: boolean): Buffer {
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
async function applyPunishments(ws: ServerWebSocket<ClientData>, intId: number, ip: string) {
    const banFinish = bans.get(ip)
    if (banFinish) {
        if (banFinish < NOW) {
            bans.delete(ip)
        }
        else {
            let banInfo:any = await makeDbRequest("exec", {
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
            let muteInfo:any = await makeDbRequest("exec", {
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

function rejectPixel(ws:ServerWebSocket<any>, i:number, cd:number) {
    const data = Buffer.alloc(10)
    data[0] = 7
    data.writeInt32BE(Math.ceil(cd / 1000) || 1, 1)
    data.writeInt32BE(i, 5)
    data[9] = CHANGES[i] == 255 ? BOARD[i] : CHANGES[i]
    ws.send(data)
}

type ClientData = {
    ip: string,
    headers: Headers,
    url: string,
    codeHash: string,
    perms: "vip"|"chatmod"|"canvasmod"|"admin",
    lastChat: number,
    connDate: number,
    cd: number,
    intId: number,
    token: string,
    chatName: string,
    voted: number,
    challenge: "pending"|"active"|undefined,
    turnstile: "active"|undefined,
    lastPeriodCaptcha: number,
    shadowBanned: boolean
}
interface RplaceServer extends Server {
    clients: Set<ServerWebSocket<ClientData>>
}
const serverOptions:TLSWebSocketServeOptions<ClientData> = {
    async fetch(req: Request, server: Server) {
        const url = new URL(req.url)
        const cookies = cookie.parse(req.headers.get("Cookie") || "")
        const userToken = cookies[uidToken]

        // CORS BS
        const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" }
        if (req.method === "OPTIONS") {
            const headers = new Headers({
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*"
            })
            return new Response(null, { status: 204, headers: headers })
        }

        // User wants to link their canvas account to the global auth server, architecture outlined in
        // https://github.com/rplacetk/architecture/blob/main/account_linkage.png
        if (url.pathname.startsWith("/users/")) {
            const targetId = parseInt(url.pathname.slice(7))
            if (Number.isNaN(targetId) || typeof targetId !== "number") {
                return new Response("Invalid user ID format", {
                    status: 400,
                    headers: corsHeaders
                })
            }

            const usersInfo = await makeDbRequest("exec", {
                stmt: "SELECT intId, chatName, lastJoined, pixelsPlaced, playTimeSeconds FROM Users WHERE intId = ?1",
                params: [ targetId ]
            })
            if (!usersInfo || !Array.isArray(usersInfo) || usersInfo.length != 1) {
                return new Response("Could not find user with specified ID", {
                    status: 404,
                    headers: corsHeaders
                })
            }

            return new Response(JSON.stringify(usersInfo[0]), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            })
        }
        else if (url.pathname.startsWith("/link/")) {
            const targetLink = url.pathname.slice(6)
            if (!targetLink) {
                return new Response("No link key provided", {
                    status: 400,
                    headers: corsHeaders
                })
            }

            const info = linkKeyInfos.get(targetLink)
            if (info) {
                linkKeyInfos.delete(targetLink)
                return new Response(JSON.stringify(info), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                })
            }

            return new Response("Provided link key info could not be found", {
                status: 404,
                headers: corsHeaders
            })
        }
        else {
            let newToken:string|null = null
            if (!userToken) {
                newToken = randomString(32)
            }
            server.upgrade(req, {
                data: {
                    url: url.pathname.slice(1).trim(),
                    headers: req.headers,
                    token: userToken || newToken
                },
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true",
                    "Set-Cookie": cookie.serialize(uidToken,
                        newToken || userToken, {
                            domain: url.hostname,
                            expires: new Date(4e12),
                            httpOnly: true, // Inaccessible from JS
                            sameSite: CORS_COOKIE ? "lax" : "none", // Cross origin
                            secure: SECURE_COOKIE, // Only over HTTPS
                            path: "/"
                        }),
                }
            })

            return undefined
        }
    },
    websocket: {
        async open(ws: ServerWebSocket<ClientData>) {
            wss.clients.add(ws)
            let realIp:string|undefined = ws.data.ip
            if (USE_CLOUDFLARE) realIp = ws.data.headers.get("cf-connecting-ip")?.split(":", 4).join(":")
            if (!realIp) realIp = ws.data.headers.get("x-forwarded-for")?.split(",")[0]?.split(":", 4).join(":")
            if (!realIp) realIp = ws.remoteAddress.split(":", 4).join(":")
            if (!realIp || realIp.startsWith("%")) return ws.close(4000, "No IP")
            const IP = ws.data.ip = realIp
            const URL = ws.data.url
            if (!isUser(IP)) {
                ws.close(4000, "Not user")
                return
            }
            if (!ws.data.headers.get("User-Agent")) {
                ws.close(4000, "No agent")
                return
            }
            if (BLACKLISTED.has(IP)) return ws.close()
            ws.subscribe("all") // receive all ws messages
            ws.data.cd = COOLDOWN
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
                ws.data.cd = vip.cooldownMs
            }
            const CD = ws.data.cd

            if (ws.data.perms !== "admin" && ws.data.perms !== "canvasmod") {
                if (CAPTCHA) {
                    await forceCaptchaSolve(ws)
                }
                if (PERIODIC_CAPTCHA_INTERVAL_SECS > 0) {
                    ws.data.lastPeriodCaptcha = NOW
                }
                if (CHALLENGE) {
                    ws.data.challenge = "pending"
                }
                if (TURNSTILE) {
                    const turnstileBuffer = encoderUTF8.encode("\x17" + TURNSTILE_SITE_KEY)
                    ws.send(turnstileBuffer)
                    ws.data.turnstile = "active"
                }
            }
            ws.data.lastChat = 0 //last chat
            ws.data.connDate = NOW //connection date

            const cooldownBuffer = Buffer.alloc(9)
            cooldownBuffer[0] = 1
            cooldownBuffer.writeUint32BE(Math.ceil((cooldowns.get(IP)||0) / 1000) || 1, 1)
            cooldownBuffer.writeUint32BE(CD + Math.min(500, 0.1 * CD), 5)
            ws.send(cooldownBuffer)
            ws.send(infoBuffer)
            ws.send(runLengthChanges())

            // Notify the client about any active canvas restrictions
            if (LOCKED) {
                const restrictionsBuffer = Buffer.alloc(2)
                restrictionsBuffer[0] = 8
                restrictionsBuffer[1] = 1
                ws.send(restrictionsBuffer)
            }

            // If a custom palette is defined, then we send to client
            // http://www.shodor.org/~efarrow/trunk/html/rgbint.html
            if (Array.isArray(PALETTE)) {
                const paletteBuffer = Buffer.alloc(1 + PALETTE.length * 4)
                paletteBuffer[0] = 0
                for (let i = 0; i < PALETTE.length; i++) {
                    paletteBuffer.writeUInt32BE(PALETTE[i], i * 4 + 1)
                }
                ws.send(paletteBuffer)
            }

            // This section is the only potentially hot DB-related code in the server, investigate optimisatiions
            const pIntId = await makeDbRequest("authenticateUser", { token: ws.data.token, ip: IP })
            if (pIntId == null || typeof pIntId != "number") {
                console.error(`Could not authenticate user ${IP}, user ID was null, even after new creation`)
                return ws.close()
            }
            ws.data.intId = pIntId
            playerIntIds.set(ws, pIntId)
            const pIdBuf = Buffer.alloc(5)
            pIdBuf.writeUInt8(11, 0) // TODO: Integrate into packet 1
            pIdBuf.writeUInt32BE(pIntId, 1)
            ws.send(pIdBuf)

            if (ws.data.codeHash) {
                postDbMessage("updateUserVip", { intId: pIntId, codeHash: ws.data.codeHash })
            }
            await applyPunishments(ws, pIntId, IP)

            const pName = await makeDbRequest("getUserChatName", pIntId) as string
            if (pName) {
                ws.data.chatName = pName
                playerChatNames.set(ws.data.intId, pName)
            }
            const nmInfoBuf = createNamesPacket(playerChatNames)
            ws.send(nmInfoBuf)
        },
        async message(ws:ServerWebSocket<ClientData>, data:string|Buffer) {
            if (typeof data === "string") return
            // Redefine as message handler is now separate from open
            const IP = ws.data.ip
            const CD = ws.data.cd

            switch (data[0]) {
                case 4: { // pixel place
                    if (data.length < 6 || ws.data.shadowBanned === true) {
                        return
                    }
                    const i = data.readUInt32BE(1)
                    const c = data[5]
                    const cd = cooldowns.get(IP) || COOLDOWN
                    const PALETTE_SIZE = PALETTE?.length || 32
                    if (i >= BOARD.length || c >= PALETTE_SIZE) {
                        return
                    }
                    if (LOCKED === true || toValidate.has(ws) || bans.has(IP) || cd > NOW
                        || ws.data.challenge === "active" || ws.data.turnstile === "active") {
                        rejectPixel(ws, i, cd)
                        return
                    }
                    // On first pixel place, give them a challenge
                    if (CHALLENGE && ws.data.challenge === "pending") {
                        ws.send(padlock.requestChallenge(ws))
                        ws.data.challenge = "active"
                    }
                    // If the time since last periodic captcha is above the interval, give them new captcha & reset period
                    if (PERIODIC_CAPTCHA_INTERVAL_SECS > 0 && (NOW - ws.data.lastPeriodCaptcha) / 1000 > PERIODIC_CAPTCHA_INTERVAL_SECS) {
                        await forceCaptchaSolve(ws)
                        ws.data.lastPeriodCaptcha = NOW
                    }
                    if (checkPreban(i % WIDTH, Math.floor(i / HEIGHT), ws)) {
                        rejectPixel(ws, i, cd)
                        return
                    }
                    CHANGES[i] = c
                    // Damn you, blob!
                    cooldowns.set(IP, NOW + CD)
                    newPixels.push({ index: i, colour: c, placer: ws })
                    postDbMessage("updatePixelPlace", ws.data.intId)
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
                    postDbMessage("setUserChatName", { intId: ws.data.intId, newName: name })

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
                    const messageHistory = await makeDbRequest("getLiveChatHistory", { messageId, count, before, channel }) as any[]

                    const messages:Buffer[] = []
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
                case 14: { // Live chat report
                    const reportCooldown = reportCooldowns.get(ws.data.ip) ||  0
                    if (reportCooldown > NOW) {
                        return
                    }
                    reportCooldowns.set(ws.data.ip, NOW + reportCooldownMs)
                    const messageId = data.readUInt32BE(1)
                    const reason = data.subarray(5, Math.min(data.byteLength, 280)).toString()
                    const message = await makeDbRequest("getLiveChatMessage", messageId) as LiveChatMessage|null
                    if (message == null) {
                        return
                    }
                    const messageSenderName = await makeDbRequest("getUserChatName", message.senderIntId)
                    // TODO: Sus - Live chat message may not be in DB by time report is received, could cause a missing foreign key reference
                    postDbMessage("insertLiveChatReport", { reporterId: ws.data.intId, messageId: messageId, reason: reason })
    
                    const sanitisedChannel = message.channel.replaceAll("```", "`​`​`​")
                    const sanitisedMessage = message.message.replaceAll("```", "`​`​`​")
                    modWebhookLog(`User **#${ws.data.intId}** (**${ws.data.chatName}**) reported live chat message:\n` +
                        `Id: **${message.messageId}**\nChannel: **${sanitisedChannel}**\nSender: **#${message.senderIntId} (${messageSenderName})**\n` +
                        `Send date: **${new Date(message.sendDate).toISOString()}**\n` +
                        `Message:\n\`\`\`\n${sanitisedMessage}\n\`\`\`\n`)
                    break
                }
                case 15: { // chat
                    if (ws.data.lastChat + (CHAT_COOLDOWN_MS || 2500) > NOW
                        || data.length > (CHAT_MAX_LENGTH || 400) || bans.has(IP) || mutes.has(IP)
                        || ws.data.shadowBanned === true) {
                        return
                    }
                    ws.data.lastChat = NOW

                    // These may or may not be defined depending on message type
                    let channel:string|null = null
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

                    let messageId = 0
                    if (type === 0 && channel != null) {
                        messageId = ++liveChatMessageId
                        const liveChat:LiveChatMessage = { messageId, message, sendDate: NOW, channel, senderIntId: ws.data.intId, repliesTo: null, deletionId: null }
                        postDbMessage("insertLiveChat", liveChat)
                    }
                    else if (positionIndex != null) {
                        messageId = ++placeChatMessageId
                        postDbMessage("insertPlaceChat", { messageId,
                            message, sendDate: NOW, senderIntId: ws.data.intId, x: Math.floor(positionIndex % WIDTH),
                            y: Math.floor(positionIndex / HEIGHT) })
                    }

                    wss.publish("all", createChatPacket(type, message, Math.floor(NOW / 1000), messageId, ws.data.intId,
                        channel, repliesTo, positionIndex))

                    if (!CHAT_WEBHOOK_URL) break
                    try {
                        if (channel != null) {
                            const hookName = ws.data.chatName?.replaceAll("@", "@​")
                            const hookChannel = channel.replaceAll("@", "@​")
                            const hookMessage = message.replaceAll("@", "@​")
                            const msgHook = { username: `[${hookChannel || "place chat"}] ${hookName || "anon"} @rplace.live`, content: hookMessage }
                            fetch(CHAT_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
                        }
                    }catch (err){ console.log("Could not post chat message to discord: " + err) }
                    break
                }
                case 16: { // Captcha
                    const response = data.subarray(1).toString()
                    const info = toValidate.get(ws)
                    if (info && response === info.answer && info.start + CAPTCHA_EXPIRY_SECS * 1000 > NOW) {
                        captchaFailed.delete(IP)
                        toValidate.delete(ws)
                        const captchaSuccessBuf = Buffer.from([16])
                        ws.send(captchaSuccessBuf)
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
                        ban(ws.data.intId, banLengthS, `${info.fails} captcha fails since ${
                            new Date(ws.data.connDate).toLocaleString()}`)
                        modWebhookLog(`Client **${IP}** **banned** by server for **${banLengthS
                            }** seconds for failing captcha **${info.fails}** times`)
                    }
                    break
                }
                case 20: { // TODO: Deprecated - votes
                    ws.data.voted ^= 1 << data[1]
                    if (ws.data.voted & (1 << data[1])) VOTES[data[1] & 31]++
                    else VOTES[data[1] & 31]--
                    break
                }
                case 21: {
                    const result = await padlock.verifySolution(ws, data)
                    if (result === "badpacket" || result === "nosolution") return ws.close(4000, "Invalid solve packet")
                    if (result === false) {
                        modWebhookLog(`Client ${IP}/${ws.data.intId} failed verification challenge, kicking`)
                        ws.close(4000, "No solution")
                        return
                    }
                    else {
                        delete ws.data.challenge
                    }
                    break
                }
                case 23: {
                    const turnstileToken = decoderUTF8.decode(data.buffer.slice(1))
                    if (!turnstileToken) return ws.close(4000, "Invalid turnstile packet")
                    const formData = new FormData()
                    formData.append("secret", TURNSTILE_PRIVATE_KEY)
                    formData.append("response", turnstileToken)
                    formData.append("remoteip", ws.data.ip)
                    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                        body: formData,
                        method: "POST"
                    })
                    if (!response.ok) {
                        modWebhookLog(`Couldn't verify turnstile for client ${IP}/${ws.data.intId} bad cloudflare HTTP response, kicking`)
                        return ws.close(4000, "Internal turnstile fail")
                    }
                    const outcome:any = await response.json()
                    if (!outcome?.success) {
                        modWebhookLog(`Client ${IP}/${ws.data.intId} gave an incorrect turnstile token, kicking`)
                        return ws.close(4000, "No turnstile")
                    }
                    const turnstileSuccessBuf = Buffer.from([24])
                    ws.send(turnstileSuccessBuf)
                    delete ws.data.turnstile
                    break
                }
                case 30: { // Client activity webdriver
                    const activityCooldown = activityCooldowns.get(ws.data.ip) ||  0
                    if (activityCooldown > NOW) {
                        return
                    }
                    activityCooldowns.set(ws.data.ip, NOW + activityCooldownMs)
                    if (data.byteLength > 1025) {
                        return
                    }
                    const detail = decoderUTF8.decode(data.buffer.slice(1))
                    ws.data.shadowBanned = true
                    const sanitisedDetail = detail.replaceAll("```", "`​`​`​")
                    modWebhookLog("Client activity reported webdriver usage:\nClient data:\n```\n" +
                        `Ip: ${ws.data.ip}\nChat name: ${ws.data.chatName}\nUser id: ${ws.data.intId}\nPerms: ${ws.data.perms}\nHeaders: ${JSON.stringify(ws.data.headers, null, 4)}\n` +
                        `Connect date: ${new Date(ws.data.connDate).toLocaleString()}\nLast period captcha: ${new Date(ws.data.lastPeriodCaptcha).toLocaleString()}\n` +
                        `\`\`\`\nClient details (untrusted):\n\`\`\`\n${sanitisedDetail}\n\`\`\`\nServer has temporarily shadowbanned this connection.`)
                    break
                }
                case 96: { // Set preban
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

                            let actionCli:ServerWebSocket<ClientData>|null = null
                            for (const [p, uid] of playerIntIds) {
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

                            let actionCli:ServerWebSocket<ClientData>|null = null
                            for (const [p, uid] of playerIntIds) {
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

                            let actionCli:ServerWebSocket<ClientData>|null = null
                            if (actionIntId !== 0) {
                                for (const [p, uid] of playerIntIds) {
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
                                actionIntId === 0 ? "**__all clients__**" : ("user **" + actionCli?.data.ip + "**")}, with reason: '${
                                actionReason.replaceAll("@", "@​")}'`)
                            break
                        }
                        case 4: { // Delete chat message
                            const actionMsgId = data.readUInt32BE(offset); offset += 4
                            const actionReason = data.subarray(offset, Math.min(data.byteLength, 300 + offset)).toString()
                            if (actionMsgId === 0 || actionReason.length == 0) return

                            postDbMessage("deleteLiveChat", {
                                messageId: actionMsgId,
                                reason: actionReason,
                                moderatorIntId: ws.data.intId })

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
                case 150: {
                    const linkKey = randomString(32)
                    linkKeyInfos.set(linkKey, { intId: ws.data.intId, dateCreated: Date.now() })
                    const linkKeyBuf = encoderUTF8.encode("\x96" + linkKey) // code 150
                    ws.send(linkKeyBuf)
                    break
                }
            }
        },
        async close(ws:ServerWebSocket<ClientData>, code: number, message: string) {
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
    port: PORT
}
if (SECURE) {
    // TODO: Report bun segfault when giving a TLS cert and key path that doesn't exist
    // Path to certbot certificate, i.e: etc/letsencrypt/live/server.rplace.live/fullchain.pem,
    // Path to certbot key, i.e: etc/letsencrypt/live/server.rplace.live/privkey.pem
    const cert = Bun.file(CERT_PATH)
    const key = Bun.file(KEY_PATH)
    if (cert.size !== 0 && key.size !== 0) {
        serverOptions.tls = { cert, key }
    }
    else {
        throw new Error("Could not start server with SECURE, cert and key file could not be opened.")
    }
}
const bunServer = Bun.serve<ClientData>(serverOptions)
// For compat with methods that use node ws clients property
// @ts-ignore
bunServer.clients = new Set<ServerWebSocket<ClientData>>()
// @ts-ignore
const wss:RplaceServer = bunServer

/**
 * Log a moderation-only message to console, the mod webhook, and the mod log text file
 * @param {string} message Raw composite string message to be logged
 */
async function modWebhookLog(message:string) {
    const messageString = `[${new Date().toLocaleString()}] ${message}`
    console.log(messageString)
    fs.appendFile("./modlog.txt", messageString+"\n\n---\n\n")

    if (MOD_WEBHOOK_URL) {
        message = message.replace("@", "@​")
        const msgHook = { username: "RPLACE SERVER", content: message }
        await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })    
    }
}

let NOW = Date.now()
setInterval(() => {
    NOW = Date.now()
}, 50)

let currentCaptcha:zcaptcha.GeneratedCaptcha|null = zcaptcha.genEmojiCaptcha
try {
    zcaptcha.init()
}
catch (e) {
    currentCaptcha = null
}

/**
 * Force a client to redo the captcha
 * @param {string|number|import('bun').ServerWebSocket<any>} identifier - String client ip address, intId or client websocket instance
 */
async function forceCaptchaSolve(identifier:string|number|ServerWebSocket<ClientData>) {
    // @ts-ignore
	let cli = identifier
    if (typeof identifier === "number") {
        for (const p of wss.clients) {
            if (p.data.intId == identifier) {
                p.close()
            }
        }
    }
    else if (typeof identifier === "string") {
        for (const p of wss.clients) {
            if (p.data.ip === identifier) {
                cli = p
            }
        }
    }
    if (!cli || typeof cli !== "object") return

    try {
        if (currentCaptcha === null) {
            throw new Error("Could not generate captcha packet. Current captcha was null")
        }
        const result = currentCaptcha()
        if (!result) return cli.close()
        const encodedDummies = encoderUTF8.encode(result.dummies)

        toValidate.set(cli, { start: NOW, answer: result.answer })
        const dv = new DataView(new ArrayBuffer(3 + encodedDummies.byteLength + result.data.byteLength))
        if (currentCaptcha == zcaptcha.genTextCaptcha) {
            dv.setUint8(0, 18)
        }
        else if (currentCaptcha == zcaptcha.genMathCaptcha) {
            dv.setUint8(0, 19)
        }
        else if (currentCaptcha == zcaptcha.genEmojiCaptcha) {
            dv.setUint8(0, 20)
        }
        else {
            throw new Error("Could not generate captcha packet. Handler for packet code doesn't exist")
        }
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

    const metadata = {  palette: PALETTE, width: WIDTH, height: HEIGHT }
    await Bun.write(path.join(PUSH_PLACE_PATH, "metadata.json"), JSON.stringify(metadata))
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

// Rolling array of window size
let pastPxps:number[] = []
let pastPxpsMin = 10 // below = unchecked
let pastPxpsWindowSize = 60 // secs = n elements in pastPxps
let pastPxpsThresholdLow = 1.2 // 120% increase
let pastPxpsThresholdHigh = 3.5 // 350% increase
let pastPxpsActionDate = 0

let pixelTick = 0
setInterval(function () {
    let pxps = 0
    for (const newPixel of newPixels) {
        if (newPixel.placer.data.perms !== "admin"
            && newPixel.placer.data.perms !== "canvasmod") {
            pxps++
        }
    }
    // Above min check threshold, has been window size secs since last corrective action, captcha enabled
    if (pxps > pastPxpsMin && NOW - pastPxpsActionDate > pastPxpsWindowSize && PXPS_SECURITY) {
        const pastSum = pastPxps.reduce((acc, val) => acc + val, 0)
        const pastAverage = pastSum / pastPxps.length
        const pastIncrease = ((pxps - pastAverage) / pastAverage)

        if (pastIncrease > pastPxpsThresholdLow) {
            let mitigation = ""
            if (CAPTCHA) {
                mitigation = "Issuing captcha to **all non admin** clients."
                for (const p of wss.clients) {
                    if (p.data.perms !== "admin") {
                        forceCaptchaSolve(p)
                    }
                }
            }
            if (pastIncrease > pastPxpsThresholdHigh) {
                const pxpsLogName = `${NOW}.pxpslog.txt`
                mitigation = `Forcing captcha for **all** non admin clients, ` +
                    `dumping a list of **all** clients to ${pxpsLogName
                    } and locking canvas for **${pastPxpsWindowSize}** seconds.`

                const reason = `Server anticheat - Locking canvas for **${pastPxpsWindowSize
                    }** seconds. Sorry for the inconvenience!`
                const reasonBuffer = encoderUTF8.encode(reason)
                const restrictionsBuffer = Buffer.alloc(2 + reasonBuffer.byteLength)
                restrictionsBuffer[0] = 8
                restrictionsBuffer[1] = 1
                restrictionsBuffer.set(reasonBuffer, 2)

                LOCKED = true
                setTimeout(() => {
                    LOCKED = false
                    const unrestrictionsBuffer = Buffer.alloc(2)
                    unrestrictionsBuffer[0] = 8
                    unrestrictionsBuffer[1] = 0
                    for (const p of wss.clients) {
                        p.send(unrestrictionsBuffer)
                    }
                }, pastPxpsWindowSize * 1000)

                const pxpsLogPath = `./${pxpsLogName}`
                if (!fs.exists(pxpsLogPath)) {
                    fs.appendFile(pxpsLogPath, "ip,intId,connDate,lastPeriodCaptcha,perms")
                }
                for (const p of wss.clients) {
                    fs.appendFile(pxpsLogPath, `\n${p.data.ip},${p.data.intId},${p.data.connDate
                        },${p.data.lastPeriodCaptcha},${p.data.perms}`)
                    p.send(restrictionsBuffer)
                }
            }

            modWebhookLog(`Detected unusual increase in pixels per second (average ${
                pastAverage / pastPxpsWindowSize}px/s over last ${pastPxpsWindowSize
                } seconds -> ${pxps}px/s (${pastIncrease * 100
                }% increase)). ${mitigation}`)

            pastPxpsActionDate = NOW
        }
    }
    pastPxps.push(pxps)
    if (pastPxps.length > pastPxpsWindowSize) {
        pastPxps.shift()
    }
    fs.appendFile("./pxps.txt", `\n${pxps},${NOW}`)

    // No new pixels
    if (newPixels.length !== 0) {
        let i = 1
        let newPixelsBuffer = null
        let newPixel = null
        if (INCLUDE_PLACER) {
            newPixelsBuffer = Buffer.alloc(1 + newPixels.length * 9)
            newPixelsBuffer[0] = 5
            while ((newPixel = newPixels.pop()) !== undefined) {
                newPixelsBuffer.writeInt32BE(newPixel.index, i); i += 4
                newPixelsBuffer[i++] = newPixel.colour
                newPixelsBuffer.writeInt32BE(newPixel.placer.data.intId, i); i += 4
            }
        }
        else {
            newPixelsBuffer = Buffer.alloc(1 + newPixels.length * 5)
            newPixelsBuffer[0] = 6
            while ((newPixel = newPixels.pop()) !== undefined) {
                newPixelsBuffer.writeInt32BE(newPixel.index, i); i += 4
                newPixelsBuffer[i++] = newPixel.colour
            }    
        }
        wss.publish("all", newPixelsBuffer)    
    }

    // Sweep up expired account linkages - 1 minute should be reasonable
    if (pixelTick % LINK_EXPIRY_SECS == 0) {
        for (const [key, info] of linkKeyInfos) {
            if (info.dateCreated + LINK_EXPIRY_SECS * 1000 < NOW) {
                linkKeyInfos.delete(key)
            }
        }
    }
    // Captcha tick
    if (pixelTick % CAPTCHA_EXPIRY_SECS == 0) {
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
    pixelTick++
}, 1000)

let pushTick = 0
const infoBuffer = Buffer.alloc(131)
infoBuffer[0] = 3
setInterval(async function () {
    pushTick++
    // @ts-ignore
    infoBuffer[1] = (realPlayers + playersOffset) >> 8
    // @ts-ignore
    infoBuffer[2] = realPlayers + playersOffset
    for (let i = 0; i < VOTES.length; i++) {
        infoBuffer.writeUint32BE(VOTES[i], (i << 2) + 3)
    }
    wss.publish("all", infoBuffer)

    // @ts-ignore
    fs.appendFile("./stats.txt", "\n" + realPlayers + "," + NOW)
    if (LOCKED === true) {
        return
    }
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

repl("|place$ ", (input:string) => console.log(eval(input)))

/**
 * Fill given canvas area with certain colour
 * @param {number} x - Start X of region
 * @param {number} y - Start Y of region
 * @param {number} x1 - End X of region
 * @param {number} y1 - End Y of region
 * @param {number} x - Int colour code index to be used
 * @param {boolean} random - Fill with random colours instead
 */
function fill(x: number, y: number, x1: number, y1: number, c = 27, random: boolean = false) {
    let w = x1 - x, h = y1 - y
    for (; y < y1; y++) {
        for (; x < x1; x++) {
            CHANGES[x + y * WIDTH] = random ? Math.floor(Math.random() * 24) : c
        }
        x = x1 - w
    }

    return `Filled an area of ${w}*${h} (${(w * h)} pixels), reload the game to see the effects`
}

type ActionFunc = (p: ServerWebSocket<any>, incomingX:number, incomingY:number) => boolean
type PrebanAction = ("kick"|"ban"|"blacklist"|"none"|ActionFunc)
interface PrebanArea {
    x: number
    y: number
    x1: number
    y1: number
    action: PrebanAction
}
const prebanArea:PrebanArea = { x: 0, y: 0, x1: 0, y1: 0, action: "kick" }
/**
 * This function is intended to allow us to ban any contributors to a heavily botted area (most likely botters)
 * by banning them as soon as we notice them placing a pixel in such area.
 * @param {number} _x - x start
 * @param {number} _y - y start
 * @param {number} _x1 - x end
 * @param {number} _y1 - y end
 * @param {PrebanAction} _action - The action to be performed on catch
 */
function setPreban(_x: number, _y: number, _x1: number, _y1: number, _action:"kick"|"ban"|"blacklist"|"none" = "kick") {
    prebanArea.x = _x; prebanArea.y = _y; prebanArea.x1 = _x1; prebanArea.y1 = _y1; prebanArea.action = _action
}
function clearPreban() {
    prebanArea.x = 0; prebanArea.y = 0; prebanArea.x1 = 0; prebanArea.y1 = 0; prebanArea.action = "kick"
}
function checkPreban(incomingX: number, incomingY: number, p: ServerWebSocket<ClientData>) {
    if (prebanArea.x == 0 && prebanArea.y == 0 && prebanArea.x1 == 0 && prebanArea.y1 == 0) return false
    if ((incomingX > prebanArea.x && incomingX < prebanArea.x1) && (incomingY > prebanArea.y && incomingY < prebanArea.y1)) {
        modWebhookLog(`Pixel placed in preban area at ${incomingX}, ${incomingY} by ${p.data.ip}`)

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
async function ban(intId: number, duration: number, reason: string|null = null, modIntId: number|null = null) {
    const start = NOW
    const finish = start + duration * 1000
    const banDbData = {
        stmt: "INSERT OR REPLACE INTO Bans (startDate, finishDate, userIntId, moderatorIntId, " +
            "reason, userAppeal, appealRejected) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params: [ start, finish, intId, modIntId, reason, null, 0 ] }
    dbWorker.postMessage({ call: "exec", data: banDbData })

    const ips:any = await makeDbRequest("exec", {
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
async function mute(intId: number, duration: number, reason: string|null = null, modIntId: number|null = null) {
    const start = NOW
    const finish = start + duration * 1000
    const muteDbData = {
        stmt: `INSERT OR REPLACE INTO Mutes
                (startDate, finishDate, userIntId, moderatorIntId, "reason, userAppeal, appealRejected)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        params: [ start, finish, intId, modIntId, reason, null, 0 ] }
    postDbMessage("exec", muteDbData)

    const ips:any = await makeDbRequest("exec", { stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?", params: intId })
    for (const ipObject of ips) {
        mutes.set(ipObject.ip, finish)
    }
}

/**
 * Permamently IP block a player by IP, via WS instance or via intID
 */
function blacklist(identifier: ServerWebSocket<any>|number|string) {
    let ip:string|null = null
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

const defaultChannels = ["en", "zh", "hi", "es", "fr", "ar", "bn", "ru", "pt", "ur", "de", "jp", "tr", "vi", "ko", "it", "fa", "sr", "az"]
/**
 * Broadcast a message as the server to all default channels, or a specific provided channel
 */
function announce(msg: string, channel: string|null = null, repliesTo:number|null = null) {
    const targetChannels = channel ? [channel] : defaultChannels
    for (const ch of targetChannels) {
        const packet = createChatPacket(0, msg, Math.floor(NOW / 1000), 0, 0, ch, repliesTo)
        for (const c of wss.clients) {
            c.send(packet)
        }
    }
}
/**
 * Expands canvas, along with updating changes and alerting all clients to a given size
 */
function expand(newWidth:number, newHeight:number) {
    if (newHeight < HEIGHT || newWidth < WIDTH) {
        console.error(`Can not expand board. ${newWidth}, ${newHeight
            } is smaller than current dimensions (${WIDTH}, ${HEIGHT}))`)
        return
    }
    const newBoard = new Uint8Array(newWidth * newHeight)
    const newChanges = new Uint8Array(newWidth * newHeight).fill(255)
    for (let y = 0; y < HEIGHT; y++) {
        newBoard.set(BOARD.subarray(y * WIDTH, (y + 1) * WIDTH), y * WIDTH)
        newChanges.set(CHANGES.subarray(y * WIDTH, (y + 1) * WIDTH), y * WIDTH)
    }
    BOARD = newBoard
    CHANGES = newChanges
    WIDTH = newWidth
    HEIGHT = newHeight

    const newChangesPacket = runLengthChanges()
    for (const c of wss.clients) {
        c.send(newChangesPacket)
    }
    console.log(`Successfully resized canvas to (${WIDTH}, ${HEIGHT}) and messaged all clients`)
    console.log("\x1b[33;4;1mREMEMBER TO UPDATE server_config.json with the new board dimensions" +
        "to avoid potential canvas corruption.\x1b[0m")
    console.log("\x1b[33;4;1mREMEMBER TO CALL pushImage() to push commit new canvas dimensions" +
        "to git\x1b[0m")
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
process.on("SIGSEGV", async function() {
    console.trace("Segfault encountered. Quitting")
    process.exit(1)
})

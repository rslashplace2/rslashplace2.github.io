import { parentPort } from "worker_threads"
import Database from 'better-sqlite3'
import { Queue } from '@datastructures-js/queue'

const db = new Database("server.db")
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

const createLiveChatMessages = `
    CREATE TABLE IF NOT EXISTS LiveChatMessages (
        messageId INTEGER PRIMARY KEY,
        sendDate INTEGER,
        channel TEXT,
        message TEXT,
        name TEXT,
        senderUid TEXT,
        uidType TEXT CHECK (uidType IN ('Account', 'IP')),
        repliesTo INTEGER,
        FOREIGN KEY (repliesTo) REFERENCES LiveChatMessages(messageId)
    );
`
db.exec(createLiveChatMessages)
const createLiveChatReactions = `
    CREATE TABLE IF NOT EXISTS LiveChatReactions (
        messageId INTEGER NOT NULL,
        reaction TEXT,
        reactorUid TEXT,
        uidType TEXT CHECK (uidType IN ('Account', 'IP')),
        FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId)
    )
`
db.exec(createLiveChatReactions)
const createPlaceChatMessages = `
    CREATE TABLE IF NOT EXISTS PlaceChatMessages (
        messageId INTEGER PRIMARY KEY AUTOINCREMENT,
        sendDate INTEGER,
        message TEXT,
        name TEXT,
        senderUid TEXT,
        uidType TEXT CHECK (uidType IN ('Account', 'IP')),
        x INTEGER,
        y INTEGER
    );
`
db.exec(createPlaceChatMessages)
const createBans = `
    CREATE TABLE IF NOT EXISTS Bans (
        banId INTEGER PRIMARY KEY AUTOINCREMENT,
        startDate INTEGER,
        finishDate INTEGER,
        userUid TEXT UNIQUE,
        uidType TEXT CHECK (uidType IN ('Account', 'IP')),
        moderatorUid TEXT,
        reason TEXT,
        userAppeal TEXT
    );
`
db.exec(createBans)
const createMutes = `
    CREATE TABLE IF NOT EXISTS Mutes (
        muteId INTEGER PRIMARY KEY AUTOINCREMENT,
        startDate INTEGER,
        finishDate INTEGER,
        userUid TEXT UNIQUE,
        uidType TEXT CHECK (uidType IN ('Account', 'IP')),
        moderatorUid TEXT,
        reason TEXT,
        userAppeal TEXT
    );
`
db.exec(createMutes)
const createPermBans = `
    CREATE TABLE IF NOT EXISTS PermBans (
        permBanId INTEGER PRIMARY KEY AUTOINCREMENT,
        startDate INTEGER,
        ip TEXT UNIQUE,
        moderatorUid TEXT,
        reason TEXT
    );
`
db.exec(createPermBans)

const insertLiveChat = db.prepare("INSERT INTO LiveChatMessages (messageId, sendDate, channel, message, name, senderUid, uidType, repliesTo) VALUES (@messageId, @sendDate, @channel, @message, @name, @senderUid, @uidType, @repliesTo)")
const insertPlaceChat = db.prepare("INSERT INTO PlaceChatMessages (sendDate, message, name, senderUid, uidType, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)")

const liveChatInserts = new Queue()
const insertLiveChats = db.transaction(() => {
    while (!liveChatInserts.isEmpty()) {
        insertLiveChat.run(liveChatInserts.dequeue())
    }
})
setInterval(insertLiveChats, 10000)

const internal = {
    getMaxLiveChatId: function() {
        const getMaxMessageId = db.prepare("SELECT MAX(messageID) AS maxMessageID FROM LiveChatMessages")
        const maxMessageID = getMaxMessageId.get().maxMessageID || 0
        return maxMessageID      
    },
    insertLiveChat: function(data) {
        // messageId, sendDate, channel, message, name, senderUid, uidType, repliesTo
        // data.messageId, data.sendDate, data.channel, data.message, data.name, data.senderUid, "IP", data.replies || "NULL"
        data.uidType = "IP"
        data.repliesTo ||=  null
        liveChatInserts.enqueue(data)
    },
    insertPlaceChat: function(data) {
        
    },
    commitShutdown: function() {
        insertLiveChats()
        db.close()
    },
    executeQuery: function(data) {
        let query = db.prepare(data)
        return query?.all()
    }
}

parentPort.on('message', (message) => {
    const result = internal[message.call] && internal[message.call](message.data)
    parentPort.postMessage({ handle: message.handle, data: result })
})

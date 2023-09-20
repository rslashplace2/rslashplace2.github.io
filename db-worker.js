import { parentPort } from "worker_threads"
import { Database } from "bun:sqlite";

import { Queue } from '@datastructures-js/queue'
import { punishmentType } from "./types"

const db = new Database("server.db")

try{
const createLiveChatMessages = `
    CREATE TABLE IF NOT EXISTS LiveChatMessages (
        messageId INTEGER PRIMARY KEY NOT NULL,
        sendDate INTEGER,
        channel TEXT,
        message TEXT,
        senderIntId INTEGER,
        repliesTo INTEGER,
        FOREIGN KEY (repliesTo) REFERENCES LiveChatMessages(messageId),
        FOREIGN KEY (senderIntId) REFERENCES Users(intId)
    )
`
db.exec(createLiveChatMessages)
const createLiveChatReactions = `
    CREATE TABLE IF NOT EXISTS LiveChatReactions (
        messageId INTEGER NOT NULL,
        reaction TEXT,
        senderIntId INTEGER,
        FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId),
        FOREIGN KEY (senderIntId) REFERENCES Users(intId)
    )
`
db.exec(createLiveChatReactions)
const createPlaceChatMessages = `
    CREATE TABLE IF NOT EXISTS PlaceChatMessages (
        messageId INTEGER PRIMARY KEY NOT NULL,
        sendDate INTEGER,
        message TEXT,
        senderIntId INTEGER,
        x INTEGER,
        y INTEGER,
        FOREIGN KEY (senderIntId) REFERENCES Users(intId)
    )
`
db.exec(createPlaceChatMessages)
const createBans = `
    CREATE TABLE IF NOT EXISTS Bans (
        banId INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        userIntId INTEGER UNIQUE,
        startDate INTEGER,
        finishDate INTEGER,
        moderatorIntId INTEGER,
        reason TEXT,
        userAppeal TEXT,
        appealRejected INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId),
        FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
    )
`
db.exec(createBans)
const createMutes = `
    CREATE TABLE IF NOT EXISTS Mutes (
        muteId INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        startDate INTEGER,
        finishDate INTEGER,
        userIntId INTEGER UNIQUE,
        moderatorIntId INTEGER,
        reason TEXT,
        userAppeal TEXT,
        appealRejected INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId),
        FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
    )
`
db.exec(createMutes)
const createUsers = `
    CREATE TABLE IF NOT EXISTS Users (
        intId INTEGER PRIMARY KEY NOT NULL,
        accountId TEXT NOT NULL,
        chatName TEXT,
        vipKey TEXT,
        token TEXT,
        lastJoined INTEGER,
        pixelsPlaced INTEGER,
        playTimeSeconds INTEGER
    );
`
db.exec(createUsers)
const createUserIps = `
    CREATE TABLE IF NOT EXISTS KnownIps (
        userIntId INTERGER NOT NULL,
        ip TEXT,
        lastUsed INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId)
    )
` // We disallow an IP being associated with more than 3 userIntIds within a week
db.exec(createUserIps)

/*
const insertLiveChat = db.prepare("INSERT INTO LiveChatMessages (messageId, sendDate, channel, message, senderIntId, repliesTo) VALUES (@messageId, @sendDate, @channel, @message, @senderIntId, @repliesTo)")
const insertPlaceChat = db.prepare("INSERT INTO PlaceChatMessages (messageId, sendDate, message, senderIntId, x, y) VALUES (@messageId, @sendDate, @message, @senderIntId, @x, @y)")

const liveChatInserts = new Queue()
const insertLiveChats = db.transaction(() => {
    while (!liveChatInserts.isEmpty()) {
        insertLiveChat.run(liveChatInserts.dequeue())
    }
})
setInterval(insertLiveChats, 10000)
*/

const internal = {
    getPunishments: function(uid) {
        const punishments = []

        const bansQuery = db.prepare("SELECT (startDate, finishDate, reason, userAppeal, appealRejected) FROM Bans where userUid = ?")
        let banInfo = bansQuery.get(uid)
        if (banInfo) {
            banInfo.type = 0
            punishments.push(banInfo)
        }

        const mutesQuery = db.prepare("SELECT (startDate, finishDate, reason, userAppeal, appealRejected) FROM Mutes where userUid = ?")
        let muteInfo = mutesQuery.get(uid)
        if (muteInfo) {
            muteInfo.type = 1
            punishments.push(muteInfo)
        }

        return punishments
    },
    setUserChatName: function(data) {
        const updateQuery = db.prepare("UPDATE Users SET chatName = ? WHERE uid = ?")
        updateQuery.run(data.newName, data.uid)
    },
    getUserChatName: function(uid) {
        const getNameQuery = db.prepare("SELECT chatName FROM Users AS chatName WHERE uid = ?")
        return getNameQuery.get(uid).chatName
    },
    getOrCreateUserUid: function(uid) {
        const selectUserQuery = db.prepare("SELECT intId FROM Users WHERE uid = ?")
        const insertUserQuery = db.prepare("INSERT INTO Users (intId, uid, uidType) VALUES (?, ?, ?)")
    
        const existingUser = selectUserQuery.get(uid)
        if (existingUser)  return existingUser.intId
        
        const selectMaxIntIdQuery = db.prepare("SELECT MAX(intId) as maxIntId FROM Users")
        const newIntId = db.transaction(() => {
            const { maxIntId } = selectMaxIntIdQuery.get()
            const intId = maxIntId !== null ? maxIntId + 1 : 1
            insertUserQuery.run(uid, intId, "IP")
            
            return intId
        })()
        
        return newIntId
    },
    getMaxLiveChatId: function() {
        const getMaxMessageId = db.prepare("SELECT MAX(messageID) AS maxMessageID FROM LiveChatMessages")
        const maxMessageID = getMaxMessageId.get().maxMessageID || 0
        return maxMessageID      
    },
    getMaxPlaceChatId: function() {
        const getMaxMessageId = db.prepare("SELECT MAX(messageID) AS maxMessageID FROM PlaceChatMessages")
        const maxMessageID = getMaxMessageId.get().maxMessageID || 0
        return maxMessageID
    },
    insertLiveChat: function(data) {
    },
    insertPlaceChat: function(data) {
        
    },
    insertMute: function(data) {

    },
    insertBan: function(data) {

    },
    commitShutdown: function() {
        insertLiveChats()
        db.close()
    },
    exec: function(data) {
        let query = db.prepare(data.stmt)
        return query?.all(...data.params)
    }
}

parentPort.on("message", (message) => {
    const result = internal[message.call] && internal[message.call](message.data)
    parentPort.postMessage({ handle: message.handle, data: result })
})
}
catch(e){console.warn(e)}
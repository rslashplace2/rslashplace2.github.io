/* eslint-disable no-inner-declarations */
import { parentPort } from 'worker_threads'
import { Database } from 'bun:sqlite'
import { Queue } from '@datastructures-js/queue'

const db = new Database("server.db")

try{
const createLiveChatMessages = `
    CREATE TABLE IF NOT EXISTS LiveChatMessages (
        messageId INTEGER PRIMARY KEY,
        sendDate INTEGER,
        channel TEXT,
        message TEXT,
        senderIntId INTEGER,
        repliesTo INTEGER,
        deletionId INTEGER,
        FOREIGN KEY (repliesTo) REFERENCES LiveChatMessages(messageId),
        FOREIGN KEY (senderIntId) REFERENCES Users(intId),
        FOREIGN KEY (deletionId) REFERENCES LiveChatDeletions(deletionId)
    )
`
db.exec(createLiveChatMessages)
const createLiveChatReactions = `
    CREATE TABLE IF NOT EXISTS LiveChatReactions (
        messageId INTEGER,
        reaction TEXT,
        senderIntId INTEGER,
        FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId),
        FOREIGN KEY (senderIntId) REFERENCES Users(intId)
    )
`
db.exec(createLiveChatReactions)
const createPlaceChatMessages = `
    CREATE TABLE IF NOT EXISTS PlaceChatMessages (
        messageId INTEGER PRIMARY KEY,
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
        banId INTEGER PRIMARY KEY,
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
        muteId INTEGER PRIMARY KEY,
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
        intId INTEGER PRIMARY KEY,
        chatName TEXT,
        token TEXT NOT NULL,
        lastJoined INTEGER,
        pixelsPlaced INTEGER,
        playTimeSeconds INTEGER
    )
`
db.exec(createUsers)
const createUserIps = `
    CREATE TABLE IF NOT EXISTS KnownIps (
        userIntId INTEGER NOT NULL,
        ip TEXT NOT NULL,
        lastUsed INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId)
    )
` // ip and userIntId combined form a composite key to identify a record
db.exec(createUserIps)
const createVipKeys = `
    CREATE TABLE IF NOT EXISTS UserVips (
        userIntId INTEGER NOT NULL,
        keyHash TEXT NOT NULL,
        lastUsed INTEGER,
        FOREIGN KEY(userIntId) REFERENCES Users(intId)
    )
`
db.exec(createVipKeys)
const createLiveChatDeletions = `
    CREATE TABLE IF NOT EXISTS LiveChatDeletions (
        deletionId INTEGER PRIMARY KEY,
        moderatorIntId INTEGER NOT NULL,
        reason TEXT,
        deletionDate INTEGER,
        FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
    )
`
db.exec(createLiveChatDeletions)


const insertLiveChat = db.prepare("INSERT INTO LiveChatMessages (messageId, message, sendDate, channel, senderIntId, repliesTo) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
const insertPlaceChat = db.prepare("INSERT INTO PlaceChatMessages (messageId, message, sendDate, senderIntId, x, y) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
const updatePixelPlaces = db.prepare("UPDATE Users SET pixelsPlaced = pixelsPlaced + ?1 WHERE intId = ?2")

const pixelPlaces = new Map() // intId, count
const liveChatInserts = new Queue()
const placeChatInserts = new Queue()
function performBulkInsertions() {
    // insert all new pixel places
    db.transaction(() => {
        for (let placePair of pixelPlaces) {
            updatePixelPlaces.run(placePair[1], placePair[0])
            pixelPlaces.delete(placePair[0])
        }
    })()

    // insert all new chats
    db.transaction(() => {
        while (!liveChatInserts.isEmpty()) {
            const data = liveChatInserts.dequeue()
            insertLiveChat.run(...data)
        }
        while (!placeChatInserts.isEmpty()) {
            const data = placeChatInserts.dequeue()
            insertPlaceChat.run(...data)
        }
    })()
}
setInterval(performBulkInsertions, 10000)

const internal = {
    /** @param {{ newName: string, intId: number }} data */
    setUserChatName: function(data) {
        const updateQuery = db.query("UPDATE Users SET chatName = ?1 WHERE intId = ?2")
        updateQuery.run(data.newName, data.intId)
    },
    getUserChatName: function(intId) {
        const getNameQuery = db.query("SELECT chatName FROM Users WHERE intId = ?1")
        const result = getNameQuery.get(intId)
        return result ? result.chatName : null
    },
    /** @param {{ token: string, ip: string }} data */
    authenticateUser: function(data) {
        const selectUser = db.query("SELECT * FROM Users WHERE token = ?1")
        const epochMs = Date.now()
        
        let user = selectUser.get(data.token)
        if (!user)  { // Create new user
            const insertUser = db.query(
                "INSERT INTO Users (token, lastJoined, pixelsPlaced, playTimeSeconds) VALUES (?1, ?2, ?3, ?4) RETURNING intId")
            user = insertUser.get(data.token, epochMs, 0, 0)
            return user.intId
        }
        else { // Update last joined
            const updateUser = db.query("UPDATE Users SET lastJoined = ?1 WHERE intId = ?2")
            updateUser.run(epochMs, user.intId)
        }
        // Add known IP if not already there
        const getIpsQuery = db.query("SELECT * FROM KnownIps WHERE userIntId = ?1")
        let ipExists = false
        for (let ipRecord of getIpsQuery.all(user.intId)) {
            if (ipRecord.ip === data.ip) ipExists = true
        }
        if (ipExists) { // Update last used
            const updateIp = db.query("UPDATE KnownIps SET lastUsed = ?1 WHERE userIntId = ?2 AND ip = ?3")
            updateIp.run(epochMs, user.intId, data.ip)
        }
        else { // Create new
            const createIp = db.query("INSERT INTO KnownIps (userIntId, ip, lastUsed) VALUES (?1, ?2, ?3)")
            createIp.run(user.intId, data.ip, epochMs)
        }
        
        return user.intId
    },
    /** @param {{ messageId: number, count: number, before: boolean, channel: string?, includeDeleted?: boolean }} data */
    getLiveChatHistory: function(data) {
        const liveChatMessageId = internal.getMaxLiveChatId()
        let params = []
        let query = `
            SELECT LiveChatMessages.*, Users.chatName AS chatName
            FROM LiveChatMessages
            INNER JOIN Users ON LiveChatMessages.senderIntId = Users.intId\n`
        let preceeding = false

        if (data.channel) {
            query += "WHERE channel = ?1\n"
            params.push(data.channel)
            preceeding = true
        }
        if (!data.includeDeleted) {
            query += "AND deletionId IS NULL\n"
            preceeding = true
        }

        // If messageId is 0 and we are getting before, it will return [count] most recent messages
        // Will give messageIDs ascending if AFTER and messageIDs descending if before to make it easier on client
        if (data.before) {
            data.messageId = Math.min(liveChatMessageId, data.messageId)
            data.count = Math.min(liveChatMessageId, data.count)
            if (data.messageId == 0) {
                query += "ORDER BY messageId DESC LIMIT ?2"
                params.push(data.count)
            }
            else {
                query += preceeding ? "AND " : ""
                query += "messageId < ?2 ORDER BY messageId DESC LIMIT ?3"
                params.push(data.messageId)
                params.push(data.count)
            }
        }
        else { // Ater
            count = Math.min(liveChatMessageId - data.messageId, data.count)
            query += preceeding ? "AND " : ""
            query += "messageId > ?2 ORDER BY messageId ASC LIMIT ?3"
            params.push(data.messageId)
            params.push(data.count)
        }

        const stmt = db.query(query)
        return stmt.all(params)
    },
    updatePixelPlace: function(intId) {
        pixelPlaces.set(intId, (pixelPlaces.get(intId)||0) + 1)
    },
    getMaxLiveChatId: function() {
        const getMaxMessageId = db.query("SELECT MAX(messageID) AS maxMessageID FROM LiveChatMessages")
        const maxMessageID = getMaxMessageId.get().maxMessageID || 0
        return maxMessageID      
    },
    getMaxPlaceChatId: function() {
        const getMaxMessageId = db.query("SELECT MAX(messageID) AS maxMessageID FROM PlaceChatMessages")
        const maxMessageID = getMaxMessageId.get().maxMessageID || 0
        return maxMessageID
    },
    commitShutdown: function() {
        performBulkInsertions()
        db.close()
    },
    /** Send date is seconds unix epoch offset, we just hope whoever calls these funcs passed in the args in the right order
     * else the DB is screwed.
     * @param {[ messageId: number, message: string, sendDate: number, channel: string, senderIntId: number, repliesTo: number  ]} data */
    insertLiveChat: function(data) {
        if (!Array.isArray(data) || data.length < 5) {
            return
        }
        if (data.length == 5) {
            data[5] = null // Set column 6 to repliesTo default
        }
        liveChatInserts.push(data)
    },
    /** Messages may or may not be in the DB by the time they are being asked to be deleted due to periodic transactions
     * @param {{ messageId: number, reason: string, moderatorIntId: number }} data
     */
    deleteLiveChat: function(data) {
        const deletionQuery = db.query(
            "INSERT INTO LiveChatDeletions (moderatorIntId, reason, deletionDate) VALUES (?1, ?2, ?3) RETURNING deletionId")
        const deletionId = deletionQuery.get()

        // If pending we can update the record in preflight
        let wasPending = false
        for (let messageData of liveChatInserts._elements) {
            if (messageData[0] === data.messageId) {
                messageData[6] = deletionId // Live chat deletion
            }
        }
        if (wasPending) return

        const query = db.query("UPDATE LiveChatMessages SET deletionId = ?1 WHERE messageId = ?2")
        query.run(deletionId, data.messageId)
    },
    /** @param {[messageId: number, message: string, sendDate: number, senderIntId: number, x: number, y: number ]} data */
    insertPlaceChat: function(data) {
        if (!Array.isArray(data) || data.length < 6) {
            return
        }
        placeChatInserts.push(data)
    },
    /** @param {{ stmt: string, params: any }} data */
    exec: function(data) {
        try {
            let query = db.query(data.stmt)
            return (typeof data.params[Symbol.iterator] === "function"
                ? query.all(...data.params)
                : query.all(data.params))
        }
        catch(err) {
            console.log(err)
            return null
        }
    },
}

parentPort.on("message", (message) => {
    const result = internal[message.call] && internal[message.call](message.data)
    parentPort.postMessage({ handle: message.handle, data: result })
})
}
catch(e){
    console.error("Error from DB worker:", e)
}

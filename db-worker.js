import { parentPort } from "worker_threads"
import { Database } from "bun:sqlite";

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
        chatName TEXT,
        vipKey TEXT,
        token TEXT NOT NULL,
        lastJoined INTEGER,
        pixelsPlaced INTEGER,
        playTimeSeconds INTEGER
    );
`
db.exec(createUsers)
const createUserIps = `
    CREATE TABLE IF NOT EXISTS KnownIps (
        userIntId INTERGER NOT NULL,
        ip TEXT NOT NULL,
        lastUsed INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId)
    )
` // ip and userIntId combined form a composite key to identify a record
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
    getPunishments: function(intId) {
        const punishments = []

        const bansQuery = db.prepare("SELECT (startDate, finishDate, reason, userAppeal, appealRejected) FROM Bans where intId = ?")
        const banInfo = bansQuery.get(intId)
        if (banInfo) {
            banInfo.type = 0
            punishments.push(banInfo)
        }

        const mutesQuery = db.prepare("SELECT (startDate, finishDate, reason, userAppeal, appealRejected) FROM Mutes where intId = ?")
        const muteInfo = mutesQuery.get(intId)
        if (muteInfo) {
            muteInfo.type = 1
            punishments.push(muteInfo)
        }

        return punishments
    },
    /** @param {{ newName: string, intId: number }} data */
    setUserChatName: function(data) {
        const updateQuery = db.prepare("UPDATE Users SET chatName = ? WHERE intId = ?")
        updateQuery.run(data.newName, data.intId)
    },
    getUserChatName: function(intId) {
        const getNameQuery = db.prepare("SELECT chatName FROM Users WHERE intId = ?")
        return getNameQuery.get(intId).chatName
    },
    /** @param {{ token: string, ip: string }} data */
    authenticateUser: function(data) { //  
        const selectUser = db.prepare("SELECT * FROM Users WHERE token = ?")
        const epochMs = Date.now()
        
        let user = selectUser.get(data.token)
        if (!user)  {
            // Create new user
            const insertUser = db.prepare("INSERT INTO Users (token, lastJoined, pixelsPlaced, playTimeSeconds) VALUES (?, ?, ?, ?) RETURNING intId")
            const intId = insertUser.get(data.token, epochMs, epochMs, 0)
            return intId
        }
        else { // Update last joined
            const updateUser = db.prepare("UPDATE Users SET lastJoined = ? WHERE intId = ?")
            updateUser.run(epochMs, user.intId)
        }
        // Add known Ip if not already there
        const getIpsQuery = db.prepare("SELECT * FROM KnownIps WHERE userIntId = ")
        let ipExists
        for (let ipRecord of getIpsQuery.all(user.intId)) {
            if (ipRecord.ip === data.ip) ipExists = true
        }
        if (ipExists) { // Update last used
            const updateIp = db.prepare("UPDATE KnownIps SET lastUsed = ? WHERE userIntId = ? AND ip = ?")
            updateIp.run(epochMs, user.intId, data.ip)
        }
        else { // Create new
            const createIp = db.prepare("INSERT INTO KnownIps (userIntId, ip, lastUsed) VALUES (?, ?, ?")
            createIp.run(user.intId, data.ip, epochMs)
        }

        return user.intId
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
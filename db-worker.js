import { parentPort } from "worker_threads"
import { Database } from "bun:sqlite";

const db = new Database("server.db")

//try{
const createLiveChatMessages = `
    CREATE TABLE IF NOT EXISTS LiveChatMessages (
        messageId INTEGER PRIMARY KEY,
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
const insertLiveChat = db.query("INSERT INTO LiveChatMessages (messageId, sendDate, channel, message, senderIntId, repliesTo) VALUES (@messageId, @sendDate, @channel, @message, @senderIntId, @repliesTo)")
const insertPlaceChat = db.query("INSERT INTO PlaceChatMessages (messageId, sendDate, message, senderIntId, x, y) VALUES (@messageId, @sendDate, @message, @senderIntId, @x, @y)")

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

        const bansQuery = db.query("SELECT (startDate, finishDate, reason, userAppeal, appealRejected) FROM Bans where intId = ?")
        const banInfo = bansQuery.get(intId)
        if (banInfo) {
            banInfo.type = 0
            punishments.push(banInfo)
        }

        const mutesQuery = db.query("SELECT (startDate, finishDate, reason, userAppeal, appealRejected) FROM Mutes where intId = ?")
        const muteInfo = mutesQuery.get(intId)
        if (muteInfo) {
            muteInfo.type = 1
            punishments.push(muteInfo)
        }

        return punishments
    },
    /** @param {{ newName: string, intId: number }} data */
    setUserChatName: function(data) {
        const updateQuery = db.query("UPDATE Users SET chatName = ?1 WHERE intId = ?2")
        updateQuery.run(data.newName, data.intId)
    },
    getUserChatName: function(intId) {
        const getNameQuery = db.query("SELECT chatName FROM Users WHERE intId = ?1")
        return getNameQuery.get(intId).chatName
    },
    /** @param {{ token: string, ip: string }} data */
    authenticateUser: function(data) { //  
        try {
        const selectUser = db.query("SELECT * FROM Users WHERE token = ?")
        const epochMs = Date.now()
        
        let user = selectUser.get(data.token)
        if (!user)  {
            // Create new user
            const insertUser = db.query(
                "INSERT INTO Users (token, lastJoined, pixelsPlaced, playTimeSeconds) VALUES (?1, ?2, ?3, ?4) RETURNING intId")
            const intId = insertUser.get(data.token, epochMs, 0, 0)
            
            return intId
        }
        else { // Update last joined
            const updateUser = db.query("UPDATE Users SET lastJoined = ?1 WHERE intId = ?2")
            updateUser.run(epochMs, user.intId)
        }
        // Add known Ip if not already there
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
        }catch(e){console.error("Failed to authenticate", e)}
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
        //insertLiveChats()
        db.close()
    },
    exec: function(data) {
        let query = db.query(data.stmt)
        return query?.all(...data.params)
    }
}

parentPort.on("message", (message) => {
    const result = internal[message.call] && internal[message.call](message.data)
    parentPort.postMessage({ handle: message.handle, data: result })
})
//}
//catch(e){console.error(e)}
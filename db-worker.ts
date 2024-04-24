/* eslint-disable jsdoc/require-param */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-inner-declarations */
import { parentPort } from 'worker_threads'
import { Database } from 'bun:sqlite'
import { Queue } from '@datastructures-js/queue'

let db = new Database("server.db")
let dbClosed = false

export type LiveChatMessage = {
    messageId: number,
    sendDate: number,
    channel: string,
    message: string,
    senderIntId: number,
    repliesTo: number|null,
    deletionId: number|null
}
export type LiveChatReaction = {
    messageId: number,
    reaction: string,
    senderIntId: number
}
export type PlaceChatMessage = {
    messageId: number,
    sendDate: number,
    message: string,
    senderIntId: number,
    x: number,
    y: number
}
export type Ban = {
    banId: number,
    userIntId: number,
    startDate: number,
    finishDate: number,
    moderatorIntId: number,
    reason: string,
    userAppeal: string,
    appealRejected: number
}
export type Mute = {
    muteId: number,
    startDate: number,
    finishDate: number,
    userIntId: number,
    moderatorIntId: number,
    reason: string,
    userAppeal: string,
    appealRejected: number
}
export type User = {
    intId: number,
    chatName: string,
    token: string,
    lastJoined: number,
    pixelsPlaced: number,
    playTimeSeconds: number
}
export type KnownIp = {
    userIntId: number,
    ip: string,
    lastUsed: number
}
export type UserVip = {
    userIntId: number,
    keyHash: string,
    lastUsed: number
}
export type DeletionMessageInfo =  {
    messageId: number,

    reason: string,
    moderatorIntId: number
}
export type DeletionInsert = {
    moderatorIntId: number,
    reason: string,
    deletionDate: number
}
export type LiveChatDeletion = {
    deletionId: number,
    moderatorIntId: number,
    reason: string,
    deletionDate: number
}
type LiveChatUpdateDeletion = { deletionId: number, messageId: number }
export type AuthenticateUser = { token: string, ip: string }
export type DbInternals = {
    setUserChatName: (data: { newName: string, intId: number }) => void,
    getUserChatName: (intId: number) => string|null,
    authenticateUser: (data: AuthenticateUser) => number|null,
    getLiveChatHistory: (data: { messageId: number, count: number, before: number, channel: string, includeDeleted?: boolean }) => LiveChatMessage[],
    updatePixelPlace: (intId: number) => void,
    getMaxLiveChatId: () => number,
    getMaxPlaceChatId: () => number,
    commitShutdown: () => void,
    insertLiveChat: (data: LiveChatMessage) => void,
    deleteLiveChat: (data: DeletionMessageInfo) => void,
    insertPlaceChat: (data: PlaceChatMessage) => void,
    updateUserVip: (data: { intId: number, codeHash: string}) => void,
    insertLiveChatReport: (data: { reporterId: number, messageId: number, reason: string }) => void,
    exec: (data: { stmt: string, params: any }) => any[]|null
}

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
const createKnownIps = `
    CREATE TABLE IF NOT EXISTS KnownIps (
        userIntId INTEGER NOT NULL,
        ip TEXT NOT NULL,
        lastUsed INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId)
    )
` // ip and userIntId combined form a composite key to identify a record
db.exec(createKnownIps)
const createVips = `
    CREATE TABLE IF NOT EXISTS UserVips (
        userIntId INTEGER NOT NULL,
        keyHash TEXT NOT NULL,
        lastUsed INTEGER,
        FOREIGN KEY(userIntId) REFERENCES Users(intId)
    )
`
db.exec(createVips)
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
const createLiveChatReports = `
    CREATE TABLE IF NOT EXISTS LiveChatReports (
        reportId INTEGER PRIMARY KEY,
        reporterId INTEGER NOT NULL,
        messageId INTEGER NOT NULL,
        reason TEXT,
        reportDate INTEGER,
        FOREIGN KEY (reporterId) REFERENCES Users(intId),
        FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId)
    )
`
db.exec(createLiveChatReports)

/**
 * Adds $ to object keys in order to make it act as a valid bun SQLite query object
 */
function toQueryObject<T extends object>(object: T): T {
    // @ts-expect-error Chicanery to keep type inference whilst transforming
    const queryObject:T = {}
    for (const k of Object.keys(object)) {
        queryObject["$" + k] = object[k]
    }
    return queryObject
}

const insertLiveChat = db.query<void, LiveChatMessage>(`
    INSERT INTO LiveChatMessages (messageId, message, sendDate, channel, senderIntId, repliesTo, deletionId)
    VALUES ($messageId, $message, $sendDate, $channel, $senderIntId, $repliesTo, $deletionId)`)
const insertPlaceChat = db.query<void, PlaceChatMessage>(`
    INSERT INTO PlaceChatMessages (messageId, message, sendDate, senderIntId, x, y)
    VALUES ($messageId, $message, $sendDate, $senderIntId, $x, $y)`)
const updatePixelPlaces = db.query<void, [number, number]>(`
    UPDATE Users SET pixelsPlaced = pixelsPlaced + ?1 WHERE intId = ?2`)

interface PublicQueue<T> extends Queue<T> {
    _elements: T[]
}
const pixelPlaces = new Map<number, number>() // intId, count
// @ts-expect-error Some chicanery to bypass them hiding _elements from the definition
const liveChatInserts:PublicQueue<LiveChatMessage> = new Queue<LiveChatMessage>()
const placeChatInserts = new Queue<PlaceChatMessage>()
/**
 * Bulk insert live chat messages, pixel places and place chats on an interval loop
 */
function performBulkInsertions() {
    // insert all new pixel places
    db.transaction(() => {
        for (const placePair of pixelPlaces) {
            updatePixelPlaces.run(placePair[1], placePair[0])
            pixelPlaces.delete(placePair[0])
        }
    })()

    // insert all new chats
    db.transaction(() => {
        while (!liveChatInserts.isEmpty()) {
            const data = liveChatInserts.dequeue()
            insertLiveChat.run(toQueryObject(data))
        }
        while (!placeChatInserts.isEmpty()) {
            const data = placeChatInserts.dequeue()
            insertPlaceChat.run(toQueryObject(data))
        }
    })()
}
setInterval(performBulkInsertions, 10000)

const internal: DbInternals = {
    setUserChatName: function(data) {
        const updateQuery = db.query("UPDATE Users SET chatName = ?1 WHERE intId = ?2")
        updateQuery.run(data.newName, data.intId)
    },
    getUserChatName: function(intId) {
        const getNameQuery = db.query<User, number>("SELECT chatName FROM Users WHERE intId = ?1")
        const result = getNameQuery.get(intId)
        return result ? result.chatName : null
    },
    authenticateUser: function(data) {
        const selectUser = db.query<User, string>("SELECT * FROM Users WHERE token = ?1")
        const epochMs = Date.now()
        
        let user = selectUser.get(data.token)
        if (!user)  { // Create new user
            const insertUser = db.query<User, [string, number, number, number]>(
                "INSERT INTO Users (token, lastJoined, pixelsPlaced, playTimeSeconds) VALUES (?1, ?2, ?3, ?4) RETURNING *")
            user = insertUser.get(data.token, epochMs, 0, 0)
            if (user == null) return null
        }
        else { // Update last joined
            const updateUser = db.query("UPDATE Users SET lastJoined = ?1 WHERE intId = ?2")
            updateUser.run(epochMs, user.intId)
        }

        // Add known IP if not already there
        const getIpsQuery = db.query<KnownIp, [number, string]>("SELECT * FROM KnownIps WHERE userIntId = ?1 AND ip = ?2")
        const ipExists = getIpsQuery.get(user.intId, data.ip)
        if (ipExists) { // Update last used
            const updateIp = db.query<void, [number, number, string]>("UPDATE KnownIps SET lastUsed = ?1 WHERE userIntId = ?2 AND ip = ?3")
            updateIp.run(epochMs, user.intId, data.ip)
        }
        else { // Create new
            const createIp = db.query<void, [number, string, number]>("INSERT INTO KnownIps (userIntId, ip, lastUsed) VALUES (?1, ?2, ?3)")
            createIp.run(user.intId, data.ip, epochMs)
        }
        
        return user.intId
    },
    getLiveChatHistory: function(data) {
        const liveChatMessageId = internal.getMaxLiveChatId()
        let params:any[] = []
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
            data.count = Math.min(liveChatMessageId - data.messageId, data.count)
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
        const getMaxMessageId = db.query<{ maxMessageId: number }, any>("SELECT MAX(messageId) AS maxMessageId FROM LiveChatMessages")
        const maxMessageId = getMaxMessageId.get()?.maxMessageId || 0
        return maxMessageId      
    },
    getMaxPlaceChatId: function() {
        const getMaxMessageId = db.query<{ maxMessageId: number }, any>("SELECT MAX(messageId) AS maxMessageId FROM PlaceChatMessages")
        const maxMessageId = getMaxMessageId.get()?.maxMessageId || 0
        return maxMessageId
    },
    commitShutdown: function() {
        if (!dbClosed) {
            performBulkInsertions()
            db.close()
            dbClosed = true    
        }
    },
    /* Send date is seconds unix epoch offset */
    insertLiveChat: function(data) {
        data.repliesTo = null
        data.deletionId = null
        liveChatInserts.push(data)
    },
    // Messages may or may not be in the DB by the time they are being asked to be deleted due to periodic transactions
    deleteLiveChat: function(data) {
        const deletionQuery = db.query<LiveChatDeletion, DeletionInsert>(
            "INSERT INTO LiveChatDeletions (moderatorIntId, reason, deletionDate) VALUES ($moderatorIntId, $reason, $deletionDate) RETURNING *")             
        const deletion = deletionQuery.get(toQueryObject({ moderatorIntId: data.moderatorIntId, reason: data.reason, deletionDate: Date.now() }))
        if (deletion == null) return

        // If pending to be inserted into DB we can update the record in preflight
        for (const messageData of liveChatInserts._elements) {
            if (messageData.messageId === data.messageId) {
                messageData.deletionId = deletion.deletionId
                return
            }
        }

        const query = db.query<void, LiveChatUpdateDeletion>("UPDATE LiveChatMessages SET deletionId = $deletionId WHERE messageId = $messageId")
        const deletionUpdate:LiveChatUpdateDeletion = { deletionId: deletion.deletionId, messageId: data.messageId }
        query.run(toQueryObject(deletionUpdate))
    },
    insertPlaceChat: function(data) {
        placeChatInserts.push(data)
    },
    updateUserVip: function(data) {
        const epochMs = Date.now()
        const getKeysQuery = db.query("SELECT * FROM UserVips WHERE userIntId = ?1 AND keyHash = ?2")
        const keyExists = getKeysQuery.get(data.intId, data.codeHash)
        
        if (keyExists) {
            const updateKeysQuery = db.query("UPDATE UserVips SET lastUsed = ?1 WHERE userIntId = ?2 AND keyHash = ?3")
            updateKeysQuery.run(epochMs, data.intId, data.codeHash)
        }
        else {
            const createVipQuery = db.query("INSERT INTO UserVips (userIntId, keyHash, lastUsed) VALUES (?1, ?2, ?3)")
            createVipQuery.run(data.intId, data.codeHash, epochMs)
        }
    },
    insertLiveChatReport: function(data) {
        const insertReportQuery = db.query("INSERT INTO LiveChatReports (reporterId, messageId, reason, reportDate) VALUES (?1, ?2, ?3, ?4)")
        insertReportQuery.run(data.reporterId, data.messageId, data.reason, Date.now())
    },
    exec: function(data) {
        try {
            const query = db.query(data.stmt)
            return (typeof data.params[Symbol.iterator] === "function"
                ? query.all(...data.params)
                : query.all(data.params))
        }
        catch(err) {
            console.log("Could not exec DB query: ", err)
            return null
        }
    },
    reInitialise: function() { //  Re-create the DB 
        internal.commitShutdown()
        db = new Database("server.db")
    }
}

parentPort?.on("message", (message) => {
    const result = internal[message.call] && internal[message.call](message.data)
    parentPort?.postMessage({ handle: message.handle, data: result })
})
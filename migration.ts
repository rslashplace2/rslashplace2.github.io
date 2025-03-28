#!/usr/bin/env bun
/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable jsdoc/require-param */

import { Database } from "bun:sqlite"
import { confirm, input, select,  } from "@inquirer/prompts"

// Types for our migrations
type Migration = {
    date: string;
    description: string;
    sql: string[];
};

// Our migrations array
const migrations: Migration[] = [
    {
        date: "04/11/2023",
        description: "This migration adds the UserVips, LiveChatDeletions tables and deletionId column to LiveChatMessages",
        sql: [
            "ALTER TABLE LiveChatMessages ADD COLUMN deletionId INTEGER",
            `CREATE TABLE IF NOT EXISTS LiveChatDeletions (
                deletionId INTEGER PRIMARY KEY,
                moderatorIntId INTEGER NOT NULL,
                reason TEXT,
                deletionDate INTEGER,
                FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
            `,
            `CREATE TABLE IF NOT EXISTS UserVips (
                userIntId INTEGER NOT NULL,
                keyHash TEXT NOT NULL,
                lastUsed INTEGER,
                FOREIGN KEY(userIntId) REFERENCES Users(intId)
            `
        ]
    },
    {
        date: "20/06/2024",
        description: "This migration adds userAgent column to KnownIps and a Linkages table",
        sql: [
            "ALTER TABLE KnownIps ADD COLUMN userAgent TEXT",
            `CREATE TABLE IF NOT EXISTS Linkages (
                userIntId INTEGER UNIQUE,
                accountId INTEGER,
                linkDate INTEGER,
                FOREIGN KEY (userIntId) REFERENCES Users(intId)
            `
        ]
    },
    {
        date: "28/03/2025",
        description: "This migration converts KnownIps to use a composite primary key (userIntId, ip, userAgent)",
        sql: [
            `CREATE TABLE IF NOT EXISTS KnownIps_new (
                userIntId INTEGER NOT NULL,
                ip TEXT NOT NULL,
                lastUsed INTEGER,
                userAgent TEXT NOT NULL,
                PRIMARY KEY (userIntId, ip, userAgent),
                FOREIGN KEY (userIntId) REFERENCES Users(intId)
            )`,
            "INSERT OR IGNORE INTO KnownIps_new (userIntId, ip, lastUsed, userAgent) SELECT userIntId, ip, lastUsed, userAgent FROM KnownIps",
            "DROP TABLE KnownIps",
            "ALTER TABLE KnownIps_new RENAME TO KnownIps",
            "CREATE INDEX IF NOT EXISTS idx_KnownIps_ip ON KnownIps(ip)",
            "CREATE INDEX IF NOT EXISTS idx_KnownIps_userIntId ON KnownIps(userIntId)"
        ]
    }
]

async function runMigration(db: Database, migration: Migration) {
    console.log(`\nMigration for ${migration.date}:`)
    console.log(migration.description)

    const proceed = await confirm({
        message: "Apply this migration to the database?",
        default: false
    })
    if (!proceed) {
        console.log("Migration cancelled")
        process.exit(0)
    }

    console.log("Executing migration...")

    try {
        // Set up transaction
        db.exec("PRAGMA foreign_keys=off")
        db.exec("BEGIN TRANSACTION")

        // Execute each SQL statement
        for (const sql of migration.sql) {
            console.log(`Running: ${sql.split('\n')[0]}...`)
            db.exec(sql)
        }

        const commit = await confirm({
            message: "Migration completed. Commit changes?",
            default: false
        })

        if (commit) {
            db.exec("COMMIT")
            console.log("Changes committed successfully")
        }
        else {
            db.exec("ROLLBACK")
            console.log("Changes rolled back")
        }

        // Restore foreign keys
        db.exec("PRAGMA foreign_keys=on")

    }
    catch (error) {
        console.error("Migration failed:", error)
        db.exec("ROLLBACK")
        db.exec("PRAGMA foreign_keys=on")
        process.exit(1)
    }
}

// Get database file from command line
const dbFile = process.argv[2]
if (!dbFile) {
    console.error("Usage: bun migrate.ts <database_file>");
    process.exit(1)
}

// Open database connection
const db = new Database(dbFile)

try {
    // Show migration options
    console.log("Available migrations:")
    

    // Get user selection
    const choice = await select({
        message: "Please select the migration you want to execute:",
        choices: migrations.map((migration, index) => ({
            name: `${index + 1}) ${migration.date}: ${migration.description}`,
            value: index
        }))
    })

    if (isNaN(choice) || choice < 1 || choice > migrations.length) {
        console.error("Invalid selection")
        process.exit(1)
    }

    // Run selected migration
    await runMigration(db, migrations[choice])

}
finally {
    // Close database connection
    db.close()
}

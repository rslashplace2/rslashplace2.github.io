#!/bin/bash
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <database_file>"
  exit 1
fi

db_file="$1"

execute_migration() {
    local description="$1"
    local sql="$2"

    read -p "$description '$db_file'. Do you want to proceed? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
      echo "Migration aborted."
      exit 1
    fi

    echo "Executing migration..."
    if ! sqlite3 "$db_file" <<< "$sql"; then
      echo "Migration failed."
      exit 1
    fi
    echo "Migration completed successfully."
}

migration_041123() {
    local description="This migration as of 04/11/23 adds the UserVips, LiveChatDeletions tables and deletionId column to LiveChatMessages."
    local sql="
    BEGIN;
    -- Add 'deletionId' to LiveChatMessages
    ALTER TABLE LiveChatMessages ADD COLUMN deletionId INTEGER;

    -- Create LiveChatDeletions table
    CREATE TABLE IF NOT EXISTS LiveChatDeletions (
        deletionId INTEGER PRIMARY KEY,
        moderatorIntId INTEGER NOT NULL,
        reason TEXT,
        deletionDate INTEGER,
        FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId),
        FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
    );

    -- Create UserVips table
    CREATE TABLE IF NOT EXISTS UserVips (
        userIntId INTEGER NOT NULL,
        keyHash TEXT NOT NULL,
        lastUsed INTEGER,
        FOREIGN KEY(userIntId) REFERENCES Users(intId)
    );

    COMMIT;
    "

    execute_migration "$description" "$sql"
}

migration_200624() {
    local description="This migration as of 20/06/24 adds userAgent column to KnownIps and a Linkages table."
    local sql="
    BEGIN;
    -- Add 'userAgent' to KnownIps
    ALTER TABLE KnownIps ADD COLUMN userAgent TEXT;

    -- Create Linkages table
    CREATE TABLE IF NOT EXISTS Linkages (
        userIntId INTEGER UNIQUE,
        accountId INTEGER,
        linkDate INTEGER,
        FOREIGN KEY (userIntId) REFERENCES Users(intId)
    );

    COMMIT;
    "

    execute_migration "$description" "$sql"
}

echo "Please choose a migration to execute:"
echo "1) Migration for 04/11/23"
echo "2) Migration for 20/06/24"
read -p "Enter the number of the migration you want to execute: " choice

case $choice in
    1)
        migration_041123
        ;;
    2)
        migration_200624
        ;;
    *)
        echo "Specified migration doesn't exist"
        exit 1
        ;;
esac
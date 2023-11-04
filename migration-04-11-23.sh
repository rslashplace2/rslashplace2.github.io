#!/bin/bash

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <database_file>"
  exit 1
fi

db_file="$1"

read -p "This migration as of 04/11/23 adds the UserVips, LiveChatDeletions tables and deletionId column to LiveChatMessages. '$db_file'. Do you want to proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
  echo "Migration aborted."
  exit 1
fi

migration_sql="
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

# Execute the migration SQL
if ! sqlite3 "$db_file" <<< "$migration_sql"; then
  echo "Migration failed."
  exit 1
fi

echo "Migration completed sucessfully."
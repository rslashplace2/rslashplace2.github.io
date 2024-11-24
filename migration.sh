#!/bin/bash
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <database_file>"
    exit 1
fi

db_file="$1"

confirm_action() {
    local prompt="$1"
    read -p "$prompt (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Action aborted."
        exit 1
    fi
}

run_sql() {
    local sql="$1"
    if ! sqlite3 "$db_file" <<< "$sql"; then
        echo "SQL execution failed."
        exit 1
    fi
}

execute_migration() {
    local description="$1"
    local sql="$2"

    confirm_action "$description '$db_file'. Do you want to proceed?"
    
    echo "Executing migration..."
    run_sql "BEGIN;"
    run_sql "$sql"

    confirm_action "Migration completed, commit?"
    
    if ! run_sql "COMMIT;"; then
        echo "Commit failed."
        exit 1
    fi

    echo "Changes committed successfully"
}

migrations=(
    "04/11/2023:This migration as of 04/11/23 adds the UserVips, LiveChatDeletions tables and deletionId column to LiveChatMessages.:\
    ALTER TABLE LiveChatMessages ADD COLUMN deletionId INTEGER;\
    CREATE TABLE IF NOT EXISTS LiveChatDeletions (\
        deletionId INTEGER PRIMARY KEY,\
        moderatorIntId INTEGER NOT NULL,\
        reason TEXT,\
        deletionDate INTEGER,\
        FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId),\
        FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)\
    );\
    CREATE TABLE IF NOT EXISTS UserVips (\
        userIntId INTEGER NOT NULL,\
        keyHash TEXT NOT NULL,\
        lastUsed INTEGER,\
        FOREIGN KEY(userIntId) REFERENCES Users(intId)\
    );"

    "20/06/2024:This migration as of 20/06/24 adds userAgent column to KnownIps and a Linkages table.:\
    ALTER TABLE KnownIps ADD COLUMN userAgent TEXT;\
    CREATE TABLE IF NOT EXISTS Linkages (\
        userIntId INTEGER UNIQUE,\
        accountId INTEGER,\
        linkDate INTEGER,\
        FOREIGN KEY (userIntId) REFERENCES Users(intId)\
    );"
)

echo "Please choose a migration to execute:"
for i in "${!migrations[@]}"; do
    migration_date=$(echo "${migrations[i]}" | cut -d':' -f1)
    echo "$((i + 1))) Migration for $migration_date"
done

read -p "Enter the number of the migration you want to execute: " choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#migrations[@]} )); then
    echo "Invalid choice."
    exit 1
fi

migration_data="${migrations[$((choice - 1))]}"
migration_description=$(echo "$migration_data" | cut -d':' -f2)
migration_sql=$(echo "$migration_data" | cut -d':' -f3)

execute_migration "$migration_description" "$migration_sql"

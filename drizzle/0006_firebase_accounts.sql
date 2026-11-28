CREATE TABLE account_firebase_links (
 firebase_uid TEXT PRIMARY KEY NOT NULL,
 account_id TEXT UNIQUE REFERENCES accounts(id),
 email TEXT NOT NULL,
 desired_username TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);

CREATE TABLE accounts (
 id TEXT PRIMARY KEY NOT NULL,
 username TEXT NOT NULL,
 username_key TEXT UNIQUE NOT NULL,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 recovery_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE account_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX account_sessions_account ON account_sessions(account_id);
--> statement-breakpoint
CREATE TABLE account_favorites (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 drama_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY (account_id,drama_id)
);
--> statement-breakpoint
CREATE TABLE account_rate_limits (
 key TEXT PRIMARY KEY NOT NULL,
 attempts INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);

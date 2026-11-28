ALTER TABLE accounts ADD COLUMN email TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX accounts_verified_email ON accounts(email) WHERE email IS NOT NULL;
--> statement-breakpoint
CREATE TABLE account_email_codes (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL,
 purpose TEXT NOT NULL,
 account_id TEXT,
 code_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 consumed_at INTEGER
);
--> statement-breakpoint
CREATE INDEX account_email_recent ON account_email_codes(email,purpose,created_at);

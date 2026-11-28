CREATE TABLE account_dislikes (account_id TEXT NOT NULL REFERENCES accounts(id), drama_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(account_id, drama_id));

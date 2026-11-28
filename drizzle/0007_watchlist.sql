CREATE TABLE account_watchlist (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 drama_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('watched','want')),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY (account_id,drama_id)
);

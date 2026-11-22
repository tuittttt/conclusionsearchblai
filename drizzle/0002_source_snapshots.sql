CREATE TABLE source_snapshots (
 source TEXT NOT NULL,
 revision TEXT NOT NULL,
 chunk_index INTEGER NOT NULL,
 payload TEXT NOT NULL,
 PRIMARY KEY (source,revision,chunk_index)
);
--> statement-breakpoint
CREATE TABLE source_status (
 source TEXT PRIMARY KEY NOT NULL,
 active_revision TEXT NOT NULL,
 success_at TEXT,
 attempt_at TEXT,
 source_updated_at TEXT,
 error TEXT
);
--> statement-breakpoint
CREATE TABLE refresh_runs (
 slot TEXT PRIMARY KEY NOT NULL,
 started_at TEXT NOT NULL,
 finished_at TEXT,
 status TEXT NOT NULL,
 summary TEXT
);

CREATE TABLE alias_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('alias', 'merge')),
  left_id TEXT NOT NULL,
  right_id TEXT,
  alias_name TEXT,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE alias_votes (
  proposal_id TEXT NOT NULL REFERENCES alias_proposals(id),
  voter_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (proposal_id, voter_hash)
);
--> statement-breakpoint
CREATE INDEX alias_proposals_creator_time ON alias_proposals(created_by, created_at);
--> statement-breakpoint
CREATE INDEX alias_votes_voter_time ON alias_votes(voter_hash, created_at);

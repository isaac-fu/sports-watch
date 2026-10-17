CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS account_preferences (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  followed_team_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  followed_player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  alerts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO accounts (id, display_name, email, timezone, created_at)
VALUES ('account-demo', 'Alex Morgan', 'alex@example.com', 'America/Los_Angeles', '2025-01-12T18:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO account_preferences (account_id, followed_team_ids, followed_player_ids, alerts)
VALUES (
  'account-demo',
  '["gsw"]'::jsonb,
  '["stephen-curry"]'::jsonb,
  '{"gameStarting": true, "closeGame": true, "finalScore": true, "standoutPerformance": false}'::jsonb
)
ON CONFLICT (account_id) DO NOTHING;

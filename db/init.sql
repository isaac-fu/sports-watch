CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  password_hash TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_idx ON accounts (LOWER(email));

CREATE TABLE IF NOT EXISTS account_preferences (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  followed_team_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  followed_player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  alerts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  game_id TEXT,
  team_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  UNIQUE (account_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions (account_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  team_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_articles_published_at_idx ON news_articles (published_at DESC);

CREATE TABLE IF NOT EXISTS saved_articles (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  team_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, article_id)
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  season INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  games_played INTEGER NOT NULL,
  points_per_game DOUBLE PRECISION NOT NULL,
  rebounds_per_game DOUBLE PRECISION NOT NULL,
  assists_per_game DOUBLE PRECISION NOT NULL,
  field_goal_percentage DOUBLE PRECISION NOT NULL,
  three_point_percentage DOUBLE PRECISION NOT NULL,
  provider TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season, player_id)
);

CREATE TABLE IF NOT EXISTS team_season_stats (
  season INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  conference_rank INTEGER NOT NULL,
  points_per_game DOUBLE PRECISION NOT NULL,
  points_allowed_per_game DOUBLE PRECISION NOT NULL,
  provider TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season, team_id)
);

CREATE TABLE IF NOT EXISTS data_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  error TEXT,
  synced_at TIMESTAMPTZ NOT NULL
);

INSERT INTO accounts (id, display_name, email, timezone, created_at)
VALUES ('account-demo', 'Alex Morgan', 'alex@example.com', 'America/Los_Angeles', '2025-01-12T18:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

UPDATE accounts SET onboarding_completed=TRUE WHERE id='account-demo';

INSERT INTO account_preferences (account_id, followed_team_ids, followed_player_ids, alerts)
VALUES (
  'account-demo',
  '["gsw"]'::jsonb,
  '["stephen-curry"]'::jsonb,
  '{"gameStarting": true, "closeGame": true, "finalScore": true, "standoutPerformance": false, "injuryUpdate": true, "leadChange": true, "milestone": false}'::jsonb
)
ON CONFLICT (account_id) DO NOTHING;

UPDATE account_preferences
SET alerts = '{"injuryUpdate": true, "leadChange": true, "milestone": false}'::jsonb || alerts;

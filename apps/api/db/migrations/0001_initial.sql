PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  opendota_league_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  league_id TEXT NOT NULL REFERENCES leagues(id),
  current_stage_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'upcoming', 'running', 'completed', 'archived')),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  opendota_team_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT,
  color TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'opendota')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS tournament_teams (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'eliminated')),
  PRIMARY KEY (tournament_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS tournament_schedule_settings (
  tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
  roster_locked INTEGER NOT NULL DEFAULT 0 CHECK (roster_locked IN (0, 1)),
  preliminary_type TEXT CHECK (preliminary_type IN ('group', 'swiss') OR preliminary_type IS NULL),
  knockout_type TEXT CHECK (knockout_type IN ('single_elimination', 'double_elimination') OR knockout_type IS NULL),
  locked_at TEXT,
  published_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS tournament_schedule_teams (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed INTEGER,
  is_seeded INTEGER NOT NULL DEFAULT 0 CHECK (is_seeded IN (0, 1)),
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tournament_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS schedule_operation_logs (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT 'admin',
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  account_id INTEGER UNIQUE,
  steam_id64 TEXT UNIQUE,
  display_name TEXT NOT NULL,
  current_team_id TEXT REFERENCES teams(id),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  current_team_id TEXT REFERENCES teams(id),
  source TEXT NOT NULL DEFAULT 'opendota' CHECK (source IN ('manual', 'opendota')),
  first_seen_match_id INTEGER,
  last_seen_match_id INTEGER,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tournament_id, player_id)
) STRICT;

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player',
  joined_at TEXT,
  left_at TEXT,
  PRIMARY KEY (team_id, player_id)
) STRICT;

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('group', 'swiss', 'knockout')),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'running', 'completed', 'locked')),
  sort_order INTEGER NOT NULL,
  advancement_rule TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'running', 'completed', 'locked')),
  pairing_status TEXT NOT NULL DEFAULT 'draft' CHECK (pairing_status IN ('draft', 'published', 'confirmed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (stage_id, round_number)
) STRICT;

CREATE TABLE IF NOT EXISTS stage_groups (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (stage_id, name)
) STRICT;

CREATE TABLE IF NOT EXISTS stage_group_teams (
  group_id TEXT NOT NULL REFERENCES stage_groups(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (group_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES stage_groups(id) ON DELETE SET NULL,
  series_kind TEXT NOT NULL DEFAULT 'regular' CHECK (series_kind IN ('regular', 'tiebreaker')),
  bo_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'live', 'result_pending', 'completed', 'conflict', 'postponed')),
  scheduled_at TEXT,
  radiant_team_id TEXT NOT NULL REFERENCES teams(id),
  dire_team_id TEXT NOT NULL REFERENCES teams(id),
  radiant_score INTEGER NOT NULL DEFAULT 0,
  dire_score INTEGER NOT NULL DEFAULT 0,
  winner_team_id TEXT REFERENCES teams(id),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS stage_manual_ranks (
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  manual_rank INTEGER,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (stage_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS swiss_byes (
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (stage_id, round_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS series_games (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  game_index INTEGER NOT NULL,
  match_id INTEGER UNIQUE,
  radiant_score INTEGER,
  dire_score INTEGER,
  winner_team_id TEXT REFERENCES teams(id),
  parse_status TEXT NOT NULL DEFAULT 'missing' CHECK (parse_status IN ('missing', 'requested', 'parsed', 'failed')),
  conflict_status TEXT NOT NULL DEFAULT 'none' CHECK (conflict_status IN ('none', 'pending', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (series_id, game_index)
) STRICT;

CREATE TABLE IF NOT EXISTS standings (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  group_name TEXT,
  series_played INTEGER NOT NULL DEFAULT 0,
  series_wins INTEGER NOT NULL DEFAULT 0,
  series_draws INTEGER NOT NULL DEFAULT 0,
  series_losses INTEGER NOT NULL DEFAULT 0,
  game_wins INTEGER NOT NULL DEFAULT 0,
  game_losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  opponent_score REAL NOT NULL DEFAULT 0,
  head_to_head_score REAL NOT NULL DEFAULT 0,
  manual_rank INTEGER,
  status TEXT NOT NULL CHECK (status IN ('advance', 'safe', 'eliminated')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (stage_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS bracket_nodes (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  bracket_group TEXT NOT NULL DEFAULT 'single' CHECK (bracket_group IN ('single', 'winner', 'loser', 'grand_final')),
  round_number INTEGER NOT NULL,
  round_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'scheduled', 'completed')),
  radiant_team_id TEXT REFERENCES teams(id),
  dire_team_id TEXT REFERENCES teams(id),
  series_id TEXT REFERENCES series(id),
  next_node_id TEXT,
  next_slot TEXT CHECK (next_slot IN ('radiant', 'dire') OR next_slot IS NULL),
  loser_next_node_id TEXT,
  loser_next_slot TEXT CHECK (loser_next_slot IN ('radiant', 'dire') OR loser_next_slot IS NULL),
  winner_team_id TEXT REFERENCES teams(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (stage_id, round_number, position)
) STRICT;

CREATE TABLE IF NOT EXISTS opendota_matches (
  match_id INTEGER PRIMARY KEY,
  league_id INTEGER,
  raw_json TEXT NOT NULL,
  parse_status TEXT NOT NULL CHECK (parse_status IN ('requested', 'parsed', 'failed')),
  requested_at TEXT,
  parsed_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  open_id TEXT UNIQUE,
  union_id TEXT,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'player', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS user_dota_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  dota_account_id INTEGER NOT NULL,
  steam_id64 TEXT NOT NULL,
  binding_status TEXT NOT NULL DEFAULT 'active' CHECK (binding_status IN ('active', 'revoked')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, player_id)
) STRICT;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS admin_roles (
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_id TEXT NOT NULL DEFAULT 'global',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (admin_user_id, role, scope_type, scope_id)
) STRICT;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_admin_id TEXT REFERENCES admin_users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS tournament_player_stats (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  summary_json TEXT NOT NULL DEFAULT '{}',
  matches_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tournament_id, player_id)
) STRICT;

CREATE TABLE IF NOT EXISTS tournament_team_stats (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  summary_json TEXT NOT NULL DEFAULT '{}',
  matches_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tournament_id, team_id)
) STRICT;

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('player', 'team')),
  target_id TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  display_text TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_users(id),
  like_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'hidden')),
  review_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tournament_id, target_type, target_id, normalized_text)
) STRICT;

CREATE TABLE IF NOT EXISTS tag_likes (
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tag_id, user_id)
) STRICT;

CREATE TABLE IF NOT EXISTS tag_reports (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES app_users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'accepted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS tag_audit_logs (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT 'admin',
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS sync_tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('discover_match', 'request_parse', 'refresh_match', 'schedule_link')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'needs_review')),
  league_id INTEGER,
  target_type TEXT,
  target_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_tournaments_league ON tournaments(league_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_team ON tournament_players(tournament_id, current_team_id);
CREATE INDEX IF NOT EXISTS idx_stages_tournament ON stages(tournament_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rounds_stage ON rounds(stage_id, round_number);
CREATE INDEX IF NOT EXISTS idx_series_round ON series(round_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_series_games_match ON series_games(match_id);
CREATE INDEX IF NOT EXISTS idx_standings_stage_rank ON standings(stage_id, rank);
CREATE INDEX IF NOT EXISTS idx_opendota_matches_league ON opendota_matches(league_id, match_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_dota_accounts_user ON user_dota_accounts(user_id, binding_status);
CREATE INDEX IF NOT EXISTS idx_user_dota_accounts_account ON user_dota_accounts(dota_account_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_target ON tags(target_type, target_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_player_identity_text ON tags(target_id, normalized_text) WHERE target_type = 'player';
CREATE INDEX IF NOT EXISTS idx_tag_audit_logs_tag ON tag_audit_logs(tag_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_tasks_status ON sync_tasks(status, next_run_at);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0001_initial');

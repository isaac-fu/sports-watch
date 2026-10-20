import { Pool } from "pg";
import type { Account, Preferences } from "./models";

declare global { var __courtsidePool: Pool | undefined; }

export function getDbPool() {
  if (!process.env.DATABASE_URL) return null;
  return globalThis.__courtsidePool ?? (globalThis.__courtsidePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
}

export async function loadAccount(accountId: string): Promise<Account | null> {
  const pool = getDbPool();
  if (!pool) return null;
  try {
    const result = await pool.query("SELECT id, display_name, email, timezone, created_at, email_verified_at FROM accounts WHERE id = $1", [accountId]);
    const row = result.rows[0];
    return row ? { id: row.id, displayName: row.display_name, email: row.email, timezone: row.timezone, createdAt: new Date(row.created_at).toISOString(), emailVerified: Boolean(row.email_verified_at) } : null;
  } catch { return null; }
}

export async function loadPreferences(accountId: string): Promise<Preferences | null> {
  const pool = getDbPool();
  if (!pool) return null;
  try {
    const result = await pool.query("SELECT followed_team_ids, followed_player_ids, alerts FROM account_preferences WHERE account_id = $1", [accountId]);
    const row = result.rows[0];
    return row ? { followedTeamIds: row.followed_team_ids, followedPlayerIds: row.followed_player_ids, alerts: row.alerts } : null;
  } catch { return null; }
}

export async function savePreferences(accountId: string, preferences: Preferences) {
  const pool = getDbPool();
  if (!pool) return false;
  try {
    await pool.query(`
      INSERT INTO account_preferences (account_id, followed_team_ids, followed_player_ids, alerts, updated_at)
      VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW())
      ON CONFLICT (account_id) DO UPDATE SET
        followed_team_ids = EXCLUDED.followed_team_ids,
        followed_player_ids = EXCLUDED.followed_player_ids,
        alerts = EXCLUDED.alerts,
        updated_at = NOW()
    `, [accountId, JSON.stringify(preferences.followedTeamIds), JSON.stringify(preferences.followedPlayerIds), JSON.stringify(preferences.alerts)]);
    return true;
  } catch { return false; }
}

import { getDbPool } from "./db";
import type { NewsArticle, Preferences } from "./models";
import { applyNewsFeedback, type NewsInterest } from "./news-feedback";
import { cachePreferences, getCurrentPreferences } from "./preferences-repository";
import { createDefaultPreferences, defaultAlertPreferences, demoAccountId } from "./store";

export async function recordNewsFeedback(accountId: string, article: NewsArticle, interest: NewsInterest): Promise<Preferences> {
  if (accountId === demoAccountId) throw new Error("The shared demo profile is read-only.");
  const pool = getDbPool();
  if (!pool) {
    const current = await getCurrentPreferences(accountId);
    const updated = { ...current, newsFeedback: applyNewsFeedback(current.newsFeedback, article, interest) };
    cachePreferences(accountId, updated);
    return updated;
  }
  const defaults = createDefaultPreferences(false);
  // Merge one article entry in SQL: concurrent votes and preference changes cannot erase each other.
  const entry = applyNewsFeedback(undefined, article, interest);
  const result = await pool.query(`
    INSERT INTO account_preferences (account_id, followed_team_ids, followed_player_ids, alerts, updated_at)
    VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW())
    ON CONFLICT (account_id) DO UPDATE SET alerts = jsonb_set(
      account_preferences.alerts, '{__newsFeedback}',
      COALESCE(account_preferences.alerts->'__newsFeedback', '{}'::jsonb) || $5::jsonb
    ), updated_at = NOW()
    RETURNING followed_team_ids, followed_player_ids, alerts
  `, [accountId, JSON.stringify(defaults.followedTeamIds), JSON.stringify(defaults.followedPlayerIds),
    JSON.stringify({ ...defaults.alerts, __newsFeedback: entry }), JSON.stringify(entry)]);
  const row = result.rows[0];
  const { __newsFeedback, ...alerts } = row.alerts;
  const updated: Preferences = { followedTeamIds: row.followed_team_ids, followedPlayerIds: row.followed_player_ids,
    alerts: { ...defaultAlertPreferences, ...alerts }, newsFeedback: __newsFeedback };
  cachePreferences(accountId, updated);
  return updated;
}

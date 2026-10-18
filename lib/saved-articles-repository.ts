import type { NewsArticle, SavedArticle } from "./models";
import { getDbPool } from "./db";

declare global { var __courtsideSavedArticlesByAccount: Record<string, SavedArticle[]> | undefined; }

const memoryByAccount = globalThis.__courtsideSavedArticlesByAccount ?? (globalThis.__courtsideSavedArticlesByAccount = {});
const memoryFor = (accountId: string) => memoryByAccount[accountId] ?? (memoryByAccount[accountId] = []);

async function ensureTable() {
  const pool = getDbPool();
  if (!pool) return null;
  await pool.query(`
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
    )
  `);
  return pool;
}

function mapRow(row: Record<string, unknown>): SavedArticle {
  return {
    id: String(row.article_id),
    title: String(row.title),
    summary: String(row.summary),
    source: String(row.source),
    publishedAt: new Date(String(row.published_at)).toISOString(),
    url: String(row.url),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    teamIds: row.team_ids as string[],
    playerIds: row.player_ids as string[],
    tags: row.tags as string[],
    savedAt: new Date(String(row.saved_at)).toISOString(),
  };
}

function saveToMemory(accountId: string, article: NewsArticle): SavedArticle {
  const existing = memoryFor(accountId).find((item) => item.id === article.id);
  if (existing) return existing;
  const saved = { ...article, savedAt: new Date().toISOString() };
  memoryFor(accountId).unshift(saved);
  return saved;
}

export async function listSavedArticles(accountId: string): Promise<SavedArticle[]> {
  try {
    const pool = await ensureTable();
    if (!pool) return [...memoryFor(accountId)];
    const result = await pool.query("SELECT * FROM saved_articles WHERE account_id=$1 ORDER BY saved_at DESC", [accountId]);
    return result.rows.map(mapRow);
  } catch {
    return [...memoryFor(accountId)];
  }
}

export async function saveArticle(accountId: string, article: NewsArticle): Promise<SavedArticle> {
  try {
    const pool = await ensureTable();
    if (!pool) return saveToMemory(accountId, article);
    const result = await pool.query(`
      INSERT INTO saved_articles (account_id, article_id, title, summary, source, published_at, url, image_url, team_ids, player_ids, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb)
      ON CONFLICT (account_id, article_id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary,
        source=EXCLUDED.source, published_at=EXCLUDED.published_at, url=EXCLUDED.url, image_url=EXCLUDED.image_url,
        team_ids=EXCLUDED.team_ids, player_ids=EXCLUDED.player_ids, tags=EXCLUDED.tags
      RETURNING *
    `, [accountId, article.id, article.title, article.summary, article.source, article.publishedAt, article.url,
      article.imageUrl ?? null, JSON.stringify(article.teamIds), JSON.stringify(article.playerIds), JSON.stringify(article.tags)]);
    return mapRow(result.rows[0]);
  } catch {
    return saveToMemory(accountId, article);
  }
}

export async function removeSavedArticle(accountId: string, articleId: string) {
  try {
    const pool = await ensureTable();
    if (pool) await pool.query("DELETE FROM saved_articles WHERE account_id=$1 AND article_id=$2", [accountId, articleId]);
  } catch { /* memory is updated below */ }
  const index = memoryFor(accountId).findIndex((article) => article.id === articleId);
  if (index >= 0) memoryFor(accountId).splice(index, 1);
}

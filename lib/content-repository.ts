import type { ArticleTextStatus, NewsArticle, PlayerStat, SyncResult, TeamStat } from "./models";
import { getDbPool } from "./db";
import { mockNews, mockPlayerStats, mockTeamStats } from "./mock-repository";
import { cleanNewsArticle } from "./news-text";

type NewsSnapshot = { articles: NewsArticle[]; source: string; syncedAt: string | null };
type StatsSnapshot = { players: PlayerStat[]; teams: TeamStat[]; source: string; syncedAt: string | null };
type ContentCache = { news?: NewsSnapshot; stats: Map<number, StatsSnapshot>; syncResults: SyncResult[] };

declare global { var __courtsideContentCache: ContentCache | undefined; var __courtsideContentTables: Promise<void> | undefined; }

const cache: ContentCache = globalThis.__courtsideContentCache ?? (globalThis.__courtsideContentCache = { stats: new Map<number, StatsSnapshot>(), syncResults: [] });

async function ensureContentTables() {
  const pool = getDbPool();
  if (!pool) return;
  if (!globalThis.__courtsideContentTables) {
    globalThis.__courtsideContentTables = pool.query(`
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
        article_text TEXT,
        article_text_fetched_at TIMESTAMPTZ,
        article_text_status TEXT NOT NULL DEFAULT 'not-attempted',
        article_text_hash TEXT,
        provider TEXT NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS news_articles_published_at_idx ON news_articles (published_at DESC);
      ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS article_text TEXT;
      ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS article_text_fetched_at TIMESTAMPTZ;
      ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS article_text_status TEXT NOT NULL DEFAULT 'not-attempted';
      ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS article_text_hash TEXT;
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
    `).then(() => undefined).catch((error) => {
      globalThis.__courtsideContentTables = undefined;
      throw error;
    });
  }
  await globalThis.__courtsideContentTables;
}

const articleFromRow = (row: Record<string, unknown>): NewsArticle => cleanNewsArticle({
  id: String(row.id), title: String(row.title), summary: String(row.summary), source: String(row.source),
  publishedAt: new Date(String(row.published_at)).toISOString(), url: String(row.url),
  imageUrl: row.image_url ? String(row.image_url) : undefined,
  teamIds: row.team_ids as string[], playerIds: row.player_ids as string[], tags: row.tags as string[],
  articleText: row.article_text ? String(row.article_text) : undefined,
  articleTextFetchedAt: row.article_text_fetched_at ? new Date(String(row.article_text_fetched_at)).toISOString() : undefined,
  articleTextStatus: String(row.article_text_status ?? "not-attempted") as ArticleTextStatus,
  articleTextHash: row.article_text_hash ? String(row.article_text_hash) : undefined,
});

export async function saveNewsArticles(articles: NewsArticle[], provider: string) {
  const syncedAt = new Date().toISOString();
  cache.news = { articles, source: provider, syncedAt };
  const pool = getDbPool();
  if (!pool) return;
  await ensureContentTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM news_articles");
    for (const article of articles) {
      await client.query(`
        INSERT INTO news_articles (id, title, summary, source, published_at, url, image_url, team_ids, player_ids, tags, article_text, article_text_fetched_at, article_text_status, article_text_hash, provider, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, source = EXCLUDED.source,
          published_at = EXCLUDED.published_at, url = EXCLUDED.url, image_url = EXCLUDED.image_url,
          team_ids = EXCLUDED.team_ids, player_ids = EXCLUDED.player_ids, tags = EXCLUDED.tags,
          article_text = EXCLUDED.article_text, article_text_fetched_at = EXCLUDED.article_text_fetched_at,
          article_text_status = EXCLUDED.article_text_status, article_text_hash = EXCLUDED.article_text_hash,
          provider = EXCLUDED.provider, synced_at = EXCLUDED.synced_at
      `, [article.id, article.title, article.summary, article.source, article.publishedAt, article.url, article.imageUrl ?? null,
        JSON.stringify(article.teamIds), JSON.stringify(article.playerIds), JSON.stringify(article.tags), article.articleText ?? null,
        article.articleTextFetchedAt ?? null, article.articleTextStatus ?? "not-attempted", article.articleTextHash ?? null, provider, syncedAt]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function loadNewsArticles(): Promise<NewsSnapshot> {
  const pool = getDbPool();
  if (pool) {
    try {
      await ensureContentTables();
      const result = await pool.query("SELECT * FROM news_articles ORDER BY published_at DESC LIMIT 100");
      if (result.rows.length > 0) return {
        articles: result.rows.map(articleFromRow),
        source: String(result.rows[0].provider),
        syncedAt: new Date(result.rows[0].synced_at).toISOString(),
      };
    } catch { /* memory and mock fallback below */ }
  }
  const snapshot = cache.news ?? { articles: mockNews, source: "mock-repository", syncedAt: null };
  return { ...snapshot, articles: snapshot.articles.map(cleanNewsArticle) };
}

export async function saveSeasonStats(season: number, stats: { players: PlayerStat[]; teams: TeamStat[] }, provider: string) {
  const syncedAt = new Date().toISOString();
  cache.stats.set(season, { ...stats, source: provider, syncedAt });
  const pool = getDbPool();
  if (!pool) return;
  await ensureContentTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM player_season_stats WHERE season=$1", [season]);
    await client.query("DELETE FROM team_season_stats WHERE season=$1", [season]);
    for (const stat of stats.players) {
      await client.query(`
        INSERT INTO player_season_stats VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (season, player_id) DO UPDATE SET player_name=EXCLUDED.player_name, team_id=EXCLUDED.team_id,
          team_name=EXCLUDED.team_name, games_played=EXCLUDED.games_played, points_per_game=EXCLUDED.points_per_game,
          rebounds_per_game=EXCLUDED.rebounds_per_game, assists_per_game=EXCLUDED.assists_per_game,
          field_goal_percentage=EXCLUDED.field_goal_percentage, three_point_percentage=EXCLUDED.three_point_percentage,
          provider=EXCLUDED.provider, synced_at=EXCLUDED.synced_at
      `, [season, stat.playerId, stat.playerName, stat.teamId, stat.teamName, stat.gamesPlayed, stat.pointsPerGame,
        stat.reboundsPerGame, stat.assistsPerGame, stat.fieldGoalPercentage, stat.threePointPercentage, provider, syncedAt]);
    }
    for (const stat of stats.teams) {
      await client.query(`
        INSERT INTO team_season_stats VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (season, team_id) DO UPDATE SET team_name=EXCLUDED.team_name, wins=EXCLUDED.wins,
          losses=EXCLUDED.losses, conference_rank=EXCLUDED.conference_rank, points_per_game=EXCLUDED.points_per_game,
          points_allowed_per_game=EXCLUDED.points_allowed_per_game, provider=EXCLUDED.provider, synced_at=EXCLUDED.synced_at
      `, [season, stat.teamId, stat.teamName, stat.wins, stat.losses, stat.conferenceRank, stat.pointsPerGame,
        stat.pointsAllowedPerGame, provider, syncedAt]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function loadSeasonStats(season: number): Promise<StatsSnapshot> {
  const pool = getDbPool();
  if (pool) {
    try {
      await ensureContentTables();
      const [playerRows, teamRows] = await Promise.all([
        pool.query("SELECT * FROM player_season_stats WHERE season=$1 ORDER BY points_per_game DESC", [season]),
        pool.query("SELECT * FROM team_season_stats WHERE season=$1 ORDER BY conference_rank", [season]),
      ]);
      if (playerRows.rows.length || teamRows.rows.length) {
        const first = playerRows.rows[0] ?? teamRows.rows[0];
        return {
          players: playerRows.rows.map((row) => ({ playerId: row.player_id, playerName: row.player_name, teamId: row.team_id, teamName: row.team_name, gamesPlayed: row.games_played, pointsPerGame: row.points_per_game, reboundsPerGame: row.rebounds_per_game, assistsPerGame: row.assists_per_game, fieldGoalPercentage: row.field_goal_percentage, threePointPercentage: row.three_point_percentage })),
          teams: teamRows.rows.map((row) => ({ teamId: row.team_id, teamName: row.team_name, season: row.season, wins: row.wins, losses: row.losses, conferenceRank: row.conference_rank, pointsPerGame: row.points_per_game, pointsAllowedPerGame: row.points_allowed_per_game })),
          source: first.provider,
          syncedAt: new Date(first.synced_at).toISOString(),
        };
      }
    } catch { /* memory and mock fallback below */ }
  }
  return cache.stats.get(season) ?? { players: mockPlayerStats, teams: mockTeamStats, source: "mock-repository", syncedAt: null };
}

export async function recordSyncResult(result: SyncResult) {
  cache.syncResults = [result, ...cache.syncResults.filter((entry) => entry.domain !== result.domain)].slice(0, 10);
  const pool = getDbPool();
  if (!pool) return;
  try {
    await ensureContentTables();
    await pool.query("INSERT INTO data_sync_runs (domain, provider, status, item_count, error, synced_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [result.domain, result.provider, result.status, result.itemCount, result.error ?? null, result.syncedAt]);
  } catch { /* sync status still remains in memory */ }
}

export async function loadLatestSyncResults() {
  const pool = getDbPool();
  if (pool) {
    try {
      await ensureContentTables();
      const result = await pool.query("SELECT DISTINCT ON (domain) domain, provider, status, item_count, error, synced_at FROM data_sync_runs ORDER BY domain, synced_at DESC");
      if (result.rows.length) return result.rows.map((row) => ({ domain: row.domain, provider: row.provider, status: row.status, itemCount: row.item_count, syncedAt: new Date(row.synced_at).toISOString(), error: row.error ?? undefined })) as SyncResult[];
    } catch { /* memory fallback below */ }
  }
  return cache.syncResults;
}

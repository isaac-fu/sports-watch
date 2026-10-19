import { getCatalog, replaceCanonicalCatalog, type Catalog } from "./catalog";
import { getDbPool } from "./db";
import type { Player, Team } from "./models";

export type CatalogSnapshot = Catalog & { source: string; syncedAt: string | null };

type CatalogCache = { source: string; syncedAt: string | null; loadedAt: number };

declare global {
  var __courtsideCatalogCache: CatalogCache | undefined;
  var __courtsideCatalogTables: Promise<void> | undefined;
}

const cache = globalThis.__courtsideCatalogCache ?? (globalThis.__courtsideCatalogCache = { source: "static-catalog", syncedAt: null, loadedAt: 0 });
cache.loadedAt ??= 0;
const catalogReadCacheMs = 5 * 60 * 1000;

async function ensureCatalogTables() {
  const pool = getDbPool();
  if (!pool) return;
  if (!globalThis.__courtsideCatalogTables) {
    globalThis.__courtsideCatalogTables = pool.query(`
      CREATE TABLE IF NOT EXISTS canonical_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        record TEXT NOT NULL DEFAULT '—',
        image_url TEXT,
        provider_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
        provider TEXT NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS canonical_players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        position TEXT NOT NULL,
        initials TEXT NOT NULL,
        color TEXT NOT NULL,
        image_url TEXT,
        provider_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
        provider TEXT NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS canonical_players_team_id_idx ON canonical_players (team_id);
    `).then(() => undefined).catch((error) => {
      globalThis.__courtsideCatalogTables = undefined;
      throw error;
    });
  }
  await globalThis.__courtsideCatalogTables;
}

const teamFromRow = (row: Record<string, unknown>): Team => ({
  id: String(row.id), name: String(row.name), short: String(row.short), color: String(row.color), record: String(row.record),
  imageUrl: row.image_url ? String(row.image_url) : undefined,
  providerIds: row.provider_ids as Record<string, string>,
});

const playerFromRow = (row: Record<string, unknown>): Player => ({
  id: String(row.id), name: String(row.name), teamId: String(row.team_id), teamName: String(row.team_name),
  position: String(row.position), initials: String(row.initials), color: String(row.color),
  imageUrl: row.image_url ? String(row.image_url) : undefined,
  providerIds: row.provider_ids as Record<string, string>,
});

export async function loadCatalog(): Promise<CatalogSnapshot> {
  const pool = getDbPool();
  if (pool) {
    if (cache.loadedAt > 0 && Date.now() - cache.loadedAt < catalogReadCacheMs) return { ...getCatalog(), source: cache.source, syncedAt: cache.syncedAt };
    try {
      await ensureCatalogTables();
      const [teamRows, playerRows] = await Promise.all([
        pool.query("SELECT * FROM canonical_teams ORDER BY name"),
        pool.query("SELECT * FROM canonical_players ORDER BY name"),
      ]);
      if (teamRows.rows.length > 0) {
        const first = teamRows.rows[0];
        const catalog = { teams: teamRows.rows.map(teamFromRow), players: playerRows.rows.map(playerFromRow) };
        replaceCanonicalCatalog(catalog);
        cache.source = String(first.provider);
        cache.syncedAt = new Date(first.synced_at).toISOString();
        cache.loadedAt = Date.now();
      }
    } catch { /* retain the in-process fallback */ }
  }
  return { ...getCatalog(), source: cache.source, syncedAt: cache.syncedAt };
}

export async function saveCatalog(catalog: Catalog, provider: string) {
  const syncedAt = new Date().toISOString();
  replaceCanonicalCatalog(catalog);
  cache.source = provider;
  cache.syncedAt = syncedAt;
  cache.loadedAt = Date.now();
  const pool = getDbPool();
  if (!pool) return;
  await ensureCatalogTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM canonical_players");
    await client.query("DELETE FROM canonical_teams");
    for (const team of catalog.teams) {
      await client.query(`
        INSERT INTO canonical_teams (id, name, short, color, record, image_url, provider_ids, provider, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
      `, [team.id, team.name, team.short, team.color, team.record, team.imageUrl ?? null, JSON.stringify(team.providerIds ?? {}), provider, syncedAt]);
    }
    for (const player of catalog.players) {
      await client.query(`
        INSERT INTO canonical_players (id, name, team_id, team_name, position, initials, color, image_url, provider_ids, provider, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
      `, [player.id, player.name, player.teamId, player.teamName, player.position, player.initials, player.color,
        player.imageUrl ?? null, JSON.stringify(player.providerIds ?? {}), provider, syncedAt]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

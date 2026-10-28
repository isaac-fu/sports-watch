import { getStatsProvider } from "./providers";
import { loadCatalog } from "./catalog-repository";
import { currentNbaSeasonStart } from "./season";
import type { SeasonStats } from "./providers/stats-provider";

type Snapshot = SeasonStats & { season: number; source: string; updatedAt: string; stale: boolean };
const cache = new Map<string, { data: Snapshot; expires: number }>();
const pending = new Map<string, Promise<Snapshot>>();
export async function getLeagueStats(season = currentNbaSeasonStart()): Promise<Snapshot> {
  await loadCatalog();
  const provider = getStatsProvider();
  const key = `${provider.name}:${season}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.data;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    try {
      const stats = await provider.getSeasonStats(season);
      const data = { ...stats, teams: stats.teams.filter((team) => team.season === undefined || team.season === season), season, source: provider.name, updatedAt: new Date().toISOString(), stale: false };
      if (cache.size >= 4) cache.delete(cache.keys().next().value!);
      cache.set(key, { data, expires: Date.now() + 300_000 });
      return data;
    } catch (error) {
      if (saved && Date.now() - Date.parse(saved.data.updatedAt) < 3_600_000) {
        const data = { ...saved.data, stale: true };
        cache.set(key, { data, expires: Date.now() + 30_000 });
        return data;
      }
      throw error;
    }
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

import type { PlayerProfile } from "./models";
import { canonicalPlayers } from "./catalog";
import { loadCatalog } from "./catalog-repository";
import { getStatsProvider } from "./providers";
import { mockStatsProvider } from "./providers/stats-provider";
import { currentNbaSeasonStart } from "./season";
import { calculatePlayerMetricRankings } from "./player-rankings";
import { getLeagueStats } from "./league-stats-service";

type CachedProfile = { profile: PlayerProfile; expiresAt: number };

declare global { var __courtsidePlayerProfiles: Map<string, CachedProfile> | undefined; }

const profileCache = globalThis.__courtsidePlayerProfiles ?? (globalThis.__courtsidePlayerProfiles = new Map());
const cacheDurationMs = 15 * 60 * 1000;

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  await loadCatalog();
  const player = canonicalPlayers.find((item) => item.id === playerId);
  if (!player) return null;

  const season = currentNbaSeasonStart();
  const provider = getStatsProvider();
  const cacheKey = `${provider.name}:${season}:${playerId}`;
  const cached = profileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  let profile: PlayerProfile;
  let leagueStats = null;
  try {
    profile = await provider.getPlayerProfile(player, season);
    if (profile.currentSeason) leagueStats = await getLeagueStats(season).catch(() => null);
  } catch {
    if (provider.name !== "mock-repository") throw new Error("Player statistics are temporarily unavailable.");
    profile = await mockStatsProvider.getPlayerProfile(player, season);
    leagueStats = await mockStatsProvider.getSeasonStats(season);
  }

  profile = { ...profile, currentSeasonRankings: leagueStats ? calculatePlayerMetricRankings(player.id, leagueStats.players) : null };

  profileCache.set(cacheKey, { profile, expiresAt: Date.now() + cacheDurationMs });
  return profile;
}

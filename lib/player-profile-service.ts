import type { PlayerProfile } from "./models";
import { mockPlayers } from "./mock-repository";
import { getStatsProvider } from "./providers";
import { mockStatsProvider } from "./providers/stats-provider";
import { currentNbaSeasonStart } from "./season";

type CachedProfile = { profile: PlayerProfile; expiresAt: number };

declare global { var __courtsidePlayerProfiles: Map<string, CachedProfile> | undefined; }

const profileCache = globalThis.__courtsidePlayerProfiles ?? (globalThis.__courtsidePlayerProfiles = new Map());
const cacheDurationMs = 15 * 60 * 1000;

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  const player = mockPlayers.find((item) => item.id === playerId);
  if (!player) return null;

  const season = currentNbaSeasonStart();
  const provider = getStatsProvider();
  const cacheKey = `${provider.name}:${season}:${playerId}`;
  const cached = profileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  let profile: PlayerProfile;
  try {
    profile = await provider.getPlayerProfile(player, season);
  } catch {
    profile = await mockStatsProvider.getPlayerProfile(player, season);
  }

  profileCache.set(cacheKey, { profile, expiresAt: Date.now() + cacheDurationMs });
  return profile;
}

import { getStatsProvider } from "@/lib/providers";
import { createNbaGameProvider } from "@/lib/game-provider";
import { emptyBoxScore, type GameBoxScore } from "@/lib/box-score";
import type { Game } from "@/lib/models";

const cache = new Map<string, { expires: number; box: GameBoxScore }>();
const pending = new Map<string, Promise<GameBoxScore>>();
export async function getCachedBoxScore(game: Game): Promise<GameBoxScore> {
  const stats = game.id.startsWith("nba-") ? createNbaGameProvider() : getStatsProvider();
  const key = `${stats.name}:${game.id}:${game.status}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.box;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    let box = emptyBoxScore(game, stats.name);
    if (game.status !== "scheduled" && stats.getBoxScore && stats.name !== "mock-repository") {
      try { box = await stats.getBoxScore(game); } catch { /* Keep scores usable during outages. */ }
    }
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { box, expires: Date.now() + (box.status === "available" && game.status === "final" ? 3_600_000 : 30_000) });
    return box;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

import type { GameCenter } from "@/lib/models";
import { getGameProvider } from "@/lib/game-provider";
import { loadCatalog } from "@/lib/catalog-repository";

export async function getGameCenter(gameId: string): Promise<GameCenter | null> {
  await loadCatalog();
  const provider = getGameProvider(gameId);
  const game = await provider.getGame(gameId).catch(() => null);
  if (!game) return null;
  // Scores and box scores do not require the subscription-only event endpoint.
  return { game, events: [], keyMoments: [], updatedAt: game.updatedAt ?? new Date().toISOString(), source: provider.name, playByPlayStatus: "unavailable" };
}

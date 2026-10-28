import { getNbaProvider } from "./providers";
import { NbaApiProvider } from "./providers/nba-api-provider";
import type { NbaProvider } from "./providers/types";
import type { Game } from "./models";

export function createNbaGameProvider(): NbaApiProvider {
  return new NbaApiProvider({
    baseUrl: process.env.NBA_API_SERVICE_URL,
    timeoutMs: Number(process.env.NBA_API_SERVICE_TIMEOUT_MS ?? "120000"),
  });
}

// Use after loadCatalog() in game-center and box-score routes. Native IDs must
// never be passed to BALLDONTLIE, even when it supplies the main scoreboard.
export function getGameProvider(gameId: string): NbaProvider {
  return gameId.startsWith("nba-") ? createNbaGameProvider() : getNbaProvider();
}

export function resolveGame(gameId: string): Promise<Game | null> {
  return getGameProvider(gameId).getGame(gameId);
}

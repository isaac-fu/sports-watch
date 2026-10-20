import type { Game } from "@/lib/models";
import { getGames } from "@/lib/mock-repository";
import { getCurrentPreferences } from "@/lib/preferences-repository";
import { getNbaProvider } from "@/lib/providers";
import { getCatchUpBrief, selectCatchUpGame } from "@/lib/recommendations/service";
import { loadNewsArticles } from "@/lib/content-repository";
import { getAccountContext } from "@/lib/auth-session";
import { getGameCenter } from "@/lib/game-center-service";
import { loadCatalog } from "@/lib/catalog-repository";
import { listSavedArticles } from "@/lib/saved-articles-repository";

export const dynamic = "force-dynamic";

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  const [preferences, news, , savedArticles] = await Promise.all([getCurrentPreferences(context.accountId), loadNewsArticles(), loadCatalog(), listSavedArticles(context.accountId)]);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let games: Game[];
  try {
    games = await getNbaProvider().getGames({ from: toDateKey(yesterday), to: toDateKey(new Date()) });
  } catch {
    games = getGames({ from: toDateKey(yesterday), to: toDateKey(new Date()) });
  }
  const requestedGameId = new URL(request.url).searchParams.get("gameId");
  const selectedGame = requestedGameId ? games.find((game) => game.id === requestedGameId) ?? null : selectCatchUpGame(preferences, games);
  const gameCenter = selectedGame ? await getGameCenter(selectedGame.id).catch(() => null) : requestedGameId ? await getGameCenter(requestedGameId).catch(() => null) : null;
  if (requestedGameId && !gameCenter) return Response.json({ error: "Game not found." }, { status: 404 });
  if (requestedGameId && gameCenter?.game.status === "scheduled") return Response.json({ error: "Catch-up becomes available after the game starts." }, { status: 409 });
  const data = getCatchUpBrief(preferences, games, news.articles, gameCenter, savedArticles);
  return Response.json({ data, meta: { candidateCount: data.moments.length, source: data.source === "play-by-play" ? "game-event-ranker" : "catch-up-news-ranker", gameId: data.game?.id ?? null, eventCount: gameCenter?.events.length ?? 0, playByPlayStatus: gameCenter?.playByPlayStatus ?? "unavailable", contentSource: news.source, syncedAt: news.syncedAt } });
}

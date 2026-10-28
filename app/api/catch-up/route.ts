import { getCachedBoxScore } from "@/lib/box-score-service";
import { createNbaGameProvider } from "@/lib/game-provider";
import type { Game } from "@/lib/models";
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
  const requestedGameId = new URL(request.url).searchParams.get("gameId");
  let games: Game[];
  const sportsProvider = process.env.STATS_DATA_PROVIDER === "nba_api" ? createNbaGameProvider() : getNbaProvider();
  try {
    games = requestedGameId ? [] : await sportsProvider.getGames({ from: toDateKey(yesterday), to: toDateKey(new Date()) });
  } catch {
    games = [];
  }
  const selectedGame = requestedGameId ? games.find((game) => game.id === requestedGameId) ?? null : selectCatchUpGame(preferences, games);
  const gameCenter = selectedGame ? await getGameCenter(selectedGame.id).catch(() => null) : requestedGameId ? await getGameCenter(requestedGameId).catch(() => null) : null;
  if (requestedGameId && !gameCenter) return Response.json({ error: "Game not found." }, { status: 404 });
  if (requestedGameId && gameCenter?.game.status === "scheduled") return Response.json({ error: "Catch-up becomes available after the game starts." }, { status: 409 });
  const box = gameCenter ? await getCachedBoxScore(gameCenter.game).catch(() => null) : null;
  const configuredNewsProvider = (process.env.NEWS_DATA_PROVIDER ?? "rss-newsapi").trim().toLowerCase();
  const contentReady = configuredNewsProvider === "mock" || (news.source !== "mock-repository" && Boolean(news.syncedAt));
  const data = getCatchUpBrief(preferences, games, contentReady ? news.articles : [], gameCenter, savedArticles, box);
  const ready = data.source === "box-score" || contentReady;
  return Response.json({ data, meta: { ready, candidateCount: data.moments.length, source: data.source === "box-score" ? "box-score-ranker" : "catch-up-news-ranker", gameId: data.game?.id ?? null, eventCount: gameCenter?.events.length ?? 0, playByPlayStatus: gameCenter?.playByPlayStatus ?? "unavailable", gameSource: gameCenter?.source ?? sportsProvider.name, contentSource: news.source, syncedAt: news.syncedAt } });
}

import { getGames } from "@/lib/mock-repository";
import { getCurrentPreferences } from "@/lib/preferences-repository";
import { getNbaProvider } from "@/lib/providers";
import { getDiscoveryRecommendations } from "@/lib/recommendations/service";
import type { Game } from "@/lib/models";
import { loadNewsArticles } from "@/lib/content-repository";
import { getAccountContext } from "@/lib/auth-session";
import { loadCatalog } from "@/lib/catalog-repository";
import { listSavedArticles } from "@/lib/saved-articles-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  const [preferences, news, , savedArticles] = await Promise.all([getCurrentPreferences(context.accountId), loadNewsArticles(), loadCatalog(), listSavedArticles(context.accountId)]);
  let games: Game[];
  try {
    games = await getNbaProvider().getGames();
  } catch {
    games = getGames();
  }
  const data = getDiscoveryRecommendations(preferences, games, news.articles, savedArticles);
  const mode = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 && savedArticles.length === 0 ? "popular" : "personalized";
  return Response.json({
    data,
    meta: {
      teamCount: data.teams.length,
      playerCount: data.players.length,
      gameCount: data.games.length,
      mode,
      source: "candidate-generators-and-discovery-rankers",
      contentSource: news.source,
      syncedAt: news.syncedAt,
    },
  });
}

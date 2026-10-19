import { getCurrentPreferences } from "@/lib/preferences-repository";
import { getPersonalizedFeed } from "@/lib/recommendations/service";
import { loadNewsArticles } from "@/lib/content-repository";
import { getAccountContext } from "@/lib/auth-session";
import { loadCatalog } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;
  const context = await getAccountContext(request);
  const [preferences, news] = await Promise.all([getCurrentPreferences(context.accountId), loadNewsArticles(), loadCatalog()]);
  const mode = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 ? "popular" : "personalized";
  const data = getPersonalizedFeed(preferences, news.articles).slice(0, limit);
  return Response.json({ data, meta: { count: data.length, mode, source: "candidate-generator-and-feed-ranker", contentSource: news.source, syncedAt: news.syncedAt } });
}

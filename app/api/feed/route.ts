import { getCurrentPreferences } from "@/lib/preferences-repository";
import { getPersonalizedFeed } from "@/lib/recommendations/service";
import { loadNewsArticles } from "@/lib/content-repository";
import { getAccountContext } from "@/lib/auth-session";
import { loadCatalog } from "@/lib/catalog-repository";
import { recordSyncResult } from "@/lib/content-repository";
import { syncNews } from "@/lib/data-sync-service";
import { listSavedArticles } from "@/lib/saved-articles-repository";

export const dynamic = "force-dynamic";

const refreshCooldownMs = 60_000;
let lastRefreshAt = 0;
let activeRefresh: Promise<void> | null = null;

function requestedLimit(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  return Number.isFinite(value) ? Math.min(50, Math.max(1, value)) : 20;
}

async function feedPayload(request: Request) {
  const limit = requestedLimit(request);
  const context = await getAccountContext(request);
  const [preferences, news, , savedArticles] = await Promise.all([getCurrentPreferences(context.accountId), loadNewsArticles(), loadCatalog(), listSavedArticles(context.accountId)]);
  const mode = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 && savedArticles.length === 0 ? "popular" : "personalized";
  const data = getPersonalizedFeed(preferences, news.articles, savedArticles).slice(0, limit);
  return { data, meta: { count: data.length, mode, source: "candidate-generator-and-feed-ranker", contentSource: news.source, syncedAt: news.syncedAt } };
}

export async function GET(request: Request) {
  return Response.json(await feedPayload(request));
}

export async function POST(request: Request) {
  const now = Date.now();
  let refreshStatus: "refreshed" | "cached" = "cached";
  if (now - lastRefreshAt >= refreshCooldownMs) {
    refreshStatus = "refreshed";
    if (!activeRefresh) {
      activeRefresh = syncNews().then(async (result) => {
        await recordSyncResult(result);
        lastRefreshAt = Date.now();
      }).finally(() => { activeRefresh = null; });
    }
    await activeRefresh;
  }
  const payload = await feedPayload(request);
  return Response.json({ ...payload, meta: { ...payload.meta, refreshStatus, refreshCooldownMs } });
}

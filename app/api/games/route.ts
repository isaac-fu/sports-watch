import { getNbaProvider } from "@/lib/providers";
import { loadCatalog } from "@/lib/catalog-repository";
import { publicCache } from "@/lib/http-cache";
import { ScheduleCache, scheduleTtlMs } from "@/lib/schedule-cache";
import type { Game } from "@/lib/models";
import { ProviderRateLimitError } from "@/lib/provider-backoff";

export const dynamic = "force-dynamic";
const scheduleCache = new ScheduleCache<Game[]>(100);

export async function GET(request: Request) {
  await loadCatalog();
  const searchParams = new URL(request.url).searchParams;
  const provider = getNbaProvider();
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const filters = { teamId: searchParams.get("teamId") ?? undefined, from: searchParams.get("from") ?? day(-1), to: searchParams.get("to") ?? day(7) };
  const key = JSON.stringify([provider.name, filters.teamId, filters.from, filters.to]);
  try {
    const entry = await scheduleCache.get(key, () => provider.getGames(filters), (games) => scheduleTtlMs(filters, games));
    const games = entry.value;
    return Response.json({ data: games, meta: { count: games.length, source: provider.name, expiresAt: entry.expiresAt } }, { headers: publicCache(Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000)), 0) });
  } catch (error) {
    const cached = scheduleCache.peek(key);
    const retryAt = error instanceof ProviderRateLimitError ? error.retryAt : Date.now() + 30_000;
    return Response.json({ data: cached?.value ?? [], meta: { count: cached?.value.length ?? 0, source: provider.name, unavailable: !cached, stale: Boolean(cached), expiresAt: retryAt, retryAt, rateLimited: error instanceof ProviderRateLimitError } }, { headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000))) } });
  }
}

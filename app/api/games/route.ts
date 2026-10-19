import { getNbaProvider } from "@/lib/providers";
import { loadCatalog } from "@/lib/catalog-repository";
import { publicCache } from "@/lib/http-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await loadCatalog();
  const searchParams = new URL(request.url).searchParams;
  const provider = getNbaProvider();
  const filters = { teamId: searchParams.get("teamId") ?? undefined, from: searchParams.get("from") ?? undefined, to: searchParams.get("to") ?? undefined };
  return provider.getGames(filters).then((games) => Response.json({ data: games, meta: { count: games.length, source: provider.name } }, { headers: publicCache(10, 30) })).catch(() => Response.json({ error: "The configured NBA provider is unavailable." }, { status: 502 }));
}

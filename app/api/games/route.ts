import { getNbaProvider } from "@/lib/providers";
import { loadCatalog } from "@/lib/catalog-repository";
import { publicCache } from "@/lib/http-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await loadCatalog();
  const searchParams = new URL(request.url).searchParams;
  const provider = getNbaProvider();
  const filters = { teamId: searchParams.get("teamId") ?? undefined, from: searchParams.get("from") ?? undefined, to: searchParams.get("to") ?? undefined };
  try {
    const games = await provider.getGames(filters);
    return Response.json({ data: games, meta: { count: games.length, source: provider.name } }, { headers: publicCache(10, 30) });
  } catch {
    return Response.json({ data: [], meta: { count: 0, source: provider.name, unavailable: true } }, { headers: publicCache(2, 5) });
  }
}

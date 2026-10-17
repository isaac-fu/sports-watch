import { getNbaProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const provider = getNbaProvider();
  const filters = { teamId: searchParams.get("teamId") ?? undefined, from: searchParams.get("from") ?? undefined, to: searchParams.get("to") ?? undefined };
  return provider.getGames(filters).then((games) => Response.json({ data: games, meta: { count: games.length, source: provider.name } })).catch(() => Response.json({ error: "The configured NBA provider is unavailable." }, { status: 502 }));
}

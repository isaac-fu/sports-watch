import { loadCatalog } from "@/lib/catalog-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadCatalog();
  return Response.json({
    data: { teams: catalog.teams, players: catalog.players },
    meta: { teamCount: catalog.teams.length, playerCount: catalog.players.length, source: catalog.source, syncedAt: catalog.syncedAt },
  });
}

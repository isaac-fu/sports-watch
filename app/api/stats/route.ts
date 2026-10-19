import { loadSeasonStats } from "@/lib/content-repository";
import { currentNbaSeasonStart, nbaSeasonLabel } from "@/lib/season";
import { publicCache } from "@/lib/http-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const teamId = searchParams.get("teamId");
  const playerId = searchParams.get("playerId");
  const season = currentNbaSeasonStart();
  const snapshot = await loadSeasonStats(season);
  const players = playerId ? snapshot.players.filter((stat) => stat.playerId === playerId) : teamId ? snapshot.players.filter((stat) => stat.teamId === teamId) : snapshot.players;
  const teams = teamId ? snapshot.teams.filter((stat) => stat.teamId === teamId) : snapshot.teams;
  return Response.json({ data: { season: nbaSeasonLabel(season), players, teams }, meta: { source: snapshot.source, syncedAt: snapshot.syncedAt } }, { headers: publicCache(300, 1800) });
}

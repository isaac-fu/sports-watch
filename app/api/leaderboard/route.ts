import { getLeagueStats } from "@/lib/league-stats-service";
import { nbaSeasonLabel } from "@/lib/season";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { enrichLeaderboard } from "@/lib/leaderboard-data";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const data = await getLeagueStats();
    return Response.json({ data: { ...data, ...enrichLeaderboard(data.players, data.teams, canonicalTeams, canonicalPlayers), seasonLabel: nbaSeasonLabel(data.season) } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Leaderboard statistics are temporarily unavailable. Please retry." }, { status: 503 });
  }
}

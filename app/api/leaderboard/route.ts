import { getLeagueStats } from "@/lib/league-stats-service";
import { nbaSeasonLabel } from "@/lib/season";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const data = await getLeagueStats();
    return Response.json({ data: { ...data, seasonLabel: nbaSeasonLabel(data.season) } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Leaderboard statistics are temporarily unavailable. Please retry." }, { status: 503 });
  }
}

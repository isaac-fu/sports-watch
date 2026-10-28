import { loadCatalog } from "@/lib/catalog-repository";
import { loadSeasonStats } from "@/lib/content-repository";
import { getStatsProvider } from "@/lib/providers";
import { currentNbaSeasonStart, nbaSeasonLabel } from "@/lib/season";
import { ScheduleCache } from "@/lib/schedule-cache";
import { currentTeamRecords } from "@/lib/team-records";

export const dynamic = "force-dynamic";
const cache = new ScheduleCache<Record<string, string>>(4);

export async function GET() {
  await loadCatalog();
  const season = currentNbaSeasonStart();
  const provider = getStatsProvider();
  const key = `${provider.name}:${season}`;
  let stale = false;
  let records: Record<string, string> = {};
  try {
    records = (await cache.get(key, async () => {
      const standings = await provider.getTeamStandings(season);
      const current = currentTeamRecords(standings, season);
      if (!Object.keys(current).length) throw new Error("No current-season standings");
      return current;
    }, () => 5 * 60_000)).value;
  } catch {
    stale = true;
    const saved = await loadSeasonStats(season);
    records = cache.peek(key)?.value ?? (saved.source === provider.name && saved.syncedAt
      ? currentTeamRecords({ season, teams: saved.teams.filter((team) => team.season === season) }, season) : {});
  }
  return Response.json({ data: records, meta: { season, seasonLabel: nbaSeasonLabel(season), stale, unavailable: !Object.keys(records).length } }, { headers: { "Cache-Control": "no-store" } });
}

import type { TeamStandingsSnapshot } from "./providers/stats-provider";

export function currentTeamRecords(snapshot: TeamStandingsSnapshot, season: number): Record<string, string> {
  if (snapshot.season !== season) return {};
  return Object.fromEntries(snapshot.teams
    .filter((team) => (team.season === undefined || team.season === season)
      && Number.isInteger(team.wins) && team.wins >= 0 && Number.isInteger(team.losses) && team.losses >= 0)
    .map((team) => [team.teamId, `${team.wins}–${team.losses}`]));
}

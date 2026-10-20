import type { Team, TeamMetricRankings, TeamStanding, TeamStat } from "./models";

const easternConference = new Set(["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DET", "IND", "MIA", "MIL", "NYK", "ORL", "PHI", "TOR", "WAS"]);

export function teamConference(team: Pick<Team, "short">): "Eastern" | "Western" {
  return easternConference.has(team.short.toUpperCase()) ? "Eastern" : "Western";
}

const winPercentage = (stat: Pick<TeamStat, "wins" | "losses">) => {
  const games = stat.wins + stat.losses;
  return games > 0 ? stat.wins / games : 0;
};

const differential = (stat: Pick<TeamStat, "pointsPerGame" | "pointsAllowedPerGame">) => stat.pointsPerGame - stat.pointsAllowedPerGame;

function competitionRank(stats: TeamStat[], selected: TeamStat, value: (stat: TeamStat) => number, descending = true) {
  const selectedValue = value(selected);
  return 1 + stats.filter((stat) => descending ? value(stat) > selectedValue : value(stat) < selectedValue).length;
}

export function calculateTeamMetricRankings(teamId: string, stats: TeamStat[]): TeamMetricRankings {
  const selected = stats.find((stat) => stat.teamId === teamId);
  if (!selected) return { record: 0, conference: 0, pointsPerGame: 0, pointsAllowedPerGame: 0, pointDifferential: 0, leagueSize: stats.length };
  return {
    record: competitionRank(stats, selected, winPercentage),
    conference: selected.conferenceRank,
    pointsPerGame: competitionRank(stats, selected, (stat) => stat.pointsPerGame),
    pointsAllowedPerGame: competitionRank(stats, selected, (stat) => stat.pointsAllowedPerGame, false),
    pointDifferential: competitionRank(stats, selected, differential),
    leagueSize: stats.length,
  };
}

export function buildTeamStandings(teams: Team[], stats: TeamStat[]): TeamStanding[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const rows = stats.flatMap((stat): TeamStanding[] => {
    const team = teamById.get(stat.teamId);
    if (!team) return [];
    return [{
      teamId: team.id,
      teamName: team.name,
      teamShort: team.short,
      color: team.color,
      imageUrl: team.imageUrl,
      conference: teamConference(team),
      conferenceRank: stat.conferenceRank,
      wins: stat.wins,
      losses: stat.losses,
      winPercentage: Number(winPercentage(stat).toFixed(3)),
      pointDifferential: Number(differential(stat).toFixed(1)),
    }];
  });
  return rows.sort((left, right) => left.conference.localeCompare(right.conference)
    || left.conferenceRank - right.conferenceRank
    || right.winPercentage - left.winPercentage
    || right.pointDifferential - left.pointDifferential);
}

import type { PlayerStat, TeamStat } from "./models";

export const leaderboardMetrics = [
  ["pointsPerGame", "PPG"], ["reboundsPerGame", "RPG"], ["assistsPerGame", "APG"],
  ["stealsPerGame", "SPG"], ["blocksPerGame", "BPG"], ["fieldGoalPercentage", "FG%"],
  ["threePointPercentage", "3P%"], ["freeThrowPercentage", "FT%"],
] as const;
export type LeaderboardMetric = typeof leaderboardMetrics[number][0];
export const hasMetric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function rankLeaderboardPlayers(players: PlayerStat[], metric: LeaderboardMetric) {
  const ordered = players.filter((player) => player.gamesPlayed > 0 && hasMetric(player[metric]))
    .sort((a, b) => b[metric]! - a[metric]! || a.playerName.localeCompare(b.playerName) || a.playerId.localeCompare(b.playerId));
  let rank = 0;
  return ordered.map((player, index) => {
    if (!index || player[metric] !== ordered[index - 1][metric]) rank = index + 1;
    return { ...player, rank };
  });
}

export function rankLeaderboardTeams(teams: TeamStat[]) {
  const percent = (team: TeamStat) => team.wins + team.losses > 0 ? team.wins / (team.wins + team.losses) : -1;
  const ordered = [...teams].sort((a, b) => percent(b) - percent(a) || b.wins - a.wins || a.teamName.localeCompare(b.teamName));
  let rank = 0;
  return ordered.map((team, index) => {
    if (!index || percent(team) !== percent(ordered[index - 1])) rank = index + 1;
    return { ...team, rank: percent(team) < 0 ? null : rank, winPercentage: percent(team) < 0 ? null : percent(team) };
  });
}

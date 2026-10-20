import type { PlayerMetricRankings, PlayerStat } from "./models";

type RankedMetric = "pointsPerGame" | "reboundsPerGame" | "assistsPerGame" | "stealsPerGame" | "fieldGoalPercentage" | "threePointPercentage";

function metricRank(players: PlayerStat[], selected: PlayerStat, metric: RankedMetric) {
  const value = selected[metric];
  if (value === undefined) return 0;
  return 1 + players.filter((player) => player[metric] !== undefined && player[metric]! > value).length;
}

export function calculatePlayerMetricRankings(playerId: string, stats: PlayerStat[]): PlayerMetricRankings | null {
  const qualified = stats.filter((player) => player.gamesPlayed > 0);
  const selected = qualified.find((player) => player.playerId === playerId);
  if (!selected) return null;
  return {
    pointsPerGame: metricRank(qualified, selected, "pointsPerGame"),
    reboundsPerGame: metricRank(qualified, selected, "reboundsPerGame"),
    assistsPerGame: metricRank(qualified, selected, "assistsPerGame"),
    stealsPerGame: metricRank(qualified, selected, "stealsPerGame"),
    fieldGoalPercentage: metricRank(qualified, selected, "fieldGoalPercentage"),
    threePointPercentage: metricRank(qualified, selected, "threePointPercentage"),
    playerCount: qualified.length,
  };
}

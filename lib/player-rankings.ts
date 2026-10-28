import type { PlayerMetricRankings, PlayerStat } from "./models";

import { hasMetric, type LeaderboardMetric } from "./leaderboard";
type RankedMetric = LeaderboardMetric;

function metricRank(players: PlayerStat[], selected: PlayerStat, metric: RankedMetric) {
  const value = selected[metric];
  if (!hasMetric(value)) return 0;
  return 1 + players.filter((player) => hasMetric(player[metric]) && player[metric]! > value).length;
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
    blocksPerGame: metricRank(qualified, selected, "blocksPerGame"),
    freeThrowPercentage: metricRank(qualified, selected, "freeThrowPercentage"),
    fieldGoalPercentage: metricRank(qualified, selected, "fieldGoalPercentage"),
    threePointPercentage: metricRank(qualified, selected, "threePointPercentage"),
    playerCount: qualified.length,
  };
}

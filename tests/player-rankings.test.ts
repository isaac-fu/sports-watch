import { describe, expect, it } from "vitest";
import type { PlayerStat } from "@/lib/models";
import { calculatePlayerMetricRankings } from "@/lib/player-rankings";

const players: PlayerStat[] = [
  { playerId: "one", playerName: "One", teamId: "a", teamName: "A", gamesPlayed: 10, pointsPerGame: 30, reboundsPerGame: 5, assistsPerGame: 8, stealsPerGame: 1, fieldGoalPercentage: 48, threePointPercentage: 40 },
  { playerId: "two", playerName: "Two", teamId: "b", teamName: "B", gamesPlayed: 10, pointsPerGame: 25, reboundsPerGame: 9, assistsPerGame: 6, stealsPerGame: 2, fieldGoalPercentage: 52, threePointPercentage: 36 },
  { playerId: "three", playerName: "Three", teamId: "c", teamName: "C", gamesPlayed: 10, pointsPerGame: 20, reboundsPerGame: 4, assistsPerGame: 4, stealsPerGame: 0.5, fieldGoalPercentage: 44, threePointPercentage: 34 },
];

describe("player season rankings", () => {
  it("ranks every current-season metric against active players", () => {
    expect(calculatePlayerMetricRankings("two", players)).toEqual({
      pointsPerGame: 2,
      reboundsPerGame: 1,
      assistsPerGame: 2,
      stealsPerGame: 1,
      blocksPerGame: 0,
      freeThrowPercentage: 0,
      fieldGoalPercentage: 1,
      threePointPercentage: 2,
      playerCount: 3,
    });
  });
});

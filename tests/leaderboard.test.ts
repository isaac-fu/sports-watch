import { describe, expect, it } from "vitest";
import { leaderboardMetrics, playerLeaderboardMetrics, rankLeaderboardPlayers, rankLeaderboardTeams } from "@/lib/leaderboard";
import { calculatePlayerMetricRankings } from "@/lib/player-rankings";
import type { PlayerStat, TeamStat } from "@/lib/models";
const player = (id: string, values: Partial<PlayerStat> = {}): PlayerStat => ({ playerId: id, playerName: id, teamId: "gsw", teamName: "Warriors", gamesPlayed: 3, pointsPerGame: 30, reboundsPerGame: 5, assistsPerGame: 7, stealsPerGame: 1, blocksPerGame: 2, fieldGoalPercentage: 50, threePointPercentage: 40, freeThrowPercentage: 90, ...values });
describe("leaderboards", () => {
  it("adds MPG before PPG only to leaderboard columns", () => {
    expect(playerLeaderboardMetrics.slice(0, 2).map(([, label]) => label)).toEqual(["MPG", "PPG"]);
    expect(rankLeaderboardPlayers([player("A", { minutesPerGame: 25 }), player("B", { minutesPerGame: 35 })], "minutesPerGame").map((p) => p.playerId)).toEqual(["B", "A"]);
  });
  it("requires ceil(70% of team games), excludes unknown teams, and ranks after filtering", () => {
    const teams = [{ teamId: "gsw", wins: 5, losses: 3 } as TeamStat];
    const players = [player("A", { gamesPlayed: 5, pointsPerGame: 50 }), player("B", { gamesPlayed: 6 }), player("C", { gamesPlayed: 8 }), player("D", { teamId: "unknown" })];
    expect(rankLeaderboardPlayers(players, "pointsPerGame", teams).map((p) => [p.playerId, p.rank])).toEqual([["B", 1], ["C", 1]]);
    expect(rankLeaderboardPlayers(players, "pointsPerGame", [])).toEqual([]);
    expect(rankLeaderboardPlayers(players, "pointsPerGame", [{ ...teams[0], wins: 0, losses: 0 }])).toEqual([]);
    expect(rankLeaderboardPlayers([player("A", { gamesPlayed: 7 })], "pointsPerGame", [{ ...teams[0], wins: 10, losses: 0 }])).toHaveLength(1);
  });
  it("keeps the requested player-column order", () => {
    expect(leaderboardMetrics.map(([, label]) => label)).toEqual(["PPG", "RPG", "APG", "SPG", "BPG", "FG%", "3P%", "FT%"]);
  });
  it.each(leaderboardMetrics)("matches profile rankings for %s", (metric) => {
    const players = [player("A"), player("B", { [metric]: 100 }), player("C")];
    for (const row of rankLeaderboardPlayers(players, metric)) expect(row.rank).toBe(calculatePlayerMetricRankings(row.playerId, players)![metric]);
  });
  it("uses competition ranks for ties and excludes missing stats and zero games", () => {
    const players = [player("A"), player("B"), player("C", { pointsPerGame: 20 }), player("D", { gamesPlayed: 0 })];
    expect(rankLeaderboardPlayers(players, "pointsPerGame").map((p) => p.rank)).toEqual([1, 1, 3]);
    expect(rankLeaderboardPlayers([player("A", { freeThrowPercentage: undefined }), player("B", { freeThrowPercentage: NaN }), player("C", { freeThrowPercentage: 0 })], "freeThrowPercentage").map((p) => p.playerId)).toEqual(["C"]);
  });
  it("sorts records by percentage rather than raw wins, and leaves 0-0 unranked", () => {
    const team = (id: string, wins: number, losses: number): TeamStat => ({ teamId: id, teamName: id, wins, losses, conferenceRank: 0, pointsPerGame: 0, pointsAllowedPerGame: 0 });
    const rows = rankLeaderboardTeams([team("A", 4, 2), team("B", 3, 0), team("C", 2, 1), team("D", 0, 0)]);
    expect(rows.map((row) => row.teamId)).toEqual(["B", "A", "C", "D"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 2, null]);
  });
});

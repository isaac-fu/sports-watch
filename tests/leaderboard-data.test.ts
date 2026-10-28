import { describe, expect, it } from "vitest";
import { enrichLeaderboard } from "@/lib/leaderboard-data";
import { rankLeaderboardTeams } from "@/lib/leaderboard";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import type { TeamStat } from "@/lib/models";
describe("leaderboard identities and conferences", () => {
  const stat = (teamId: string, wins: number, losses: number): TeamStat => ({ teamId, teamName: teamId, wins, losses, conferenceRank: 0, pointsPerGame: 0, pointsAllowedPerGame: 0 });
  it("assigns conferences through canonical teams and ranks within each conference", () => {
    const data = enrichLeaderboard([], [stat("gsw", 3, 1), stat("lal", 1, 3), stat("bos", 4, 0)], canonicalTeams, []);
    expect(data.teams.map((team) => team.conference)).toEqual(["Western", "Western", "Eastern"]);
    expect(rankLeaderboardTeams(data.teams.filter((team) => team.conference === "Western")).map((team) => team.rank)).toEqual([1, 2]);
    expect(rankLeaderboardTeams(data.teams.filter((team) => team.conference === "Eastern"))[0].rank).toBe(1);
  });
  it("joins images by canonical IDs and preserves missing identities without guessing conferences", () => {
    const player = canonicalPlayers[0];
    const teams = canonicalTeams.map((team) => ({ ...team, imageUrl: `https://example.com/${team.id}.png` }));
    const players = [{ ...player, imageUrl: "https://example.com/player.png" }];
    const data = enrichLeaderboard([{ playerId: player.id, playerName: player.name, teamId: player.teamId, teamName: player.teamName, gamesPlayed: 1, pointsPerGame: 1, reboundsPerGame: 1, assistsPerGame: 1, fieldGoalPercentage: 50, threePointPercentage: 40 }], [stat(player.teamId, 1, 0), stat("unknown", 1, 0)], teams, players);
    expect(data.players[0].imageUrl).toBe(players[0].imageUrl);
    expect(data.players[0].teamImageUrl).toBe(`https://example.com/${player.teamId}.png`);
    expect(data.teams[0].imageUrl).toBe(data.players[0].teamImageUrl);
    expect(data.teams[1]).toMatchObject({ conference: null, imageUrl: undefined });
  });
});

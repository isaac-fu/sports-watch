import { describe, expect, it } from "vitest";
import type { Team, TeamStat } from "@/lib/models";
import { buildTeamStandings, calculateTeamMetricRankings } from "@/lib/team-standings";

const teams: Team[] = [
  { id: "bos", name: "Boston Celtics", short: "BOS", color: "green", record: "60–22" },
  { id: "nyk", name: "New York Knicks", short: "NYK", color: "blue", record: "50–32" },
  { id: "okc", name: "Oklahoma City Thunder", short: "OKC", color: "orange", record: "58–24" },
];
const stats: TeamStat[] = [
  { teamId: "bos", teamName: "Boston Celtics", wins: 60, losses: 22, conferenceRank: 1, pointsPerGame: 120, pointsAllowedPerGame: 109 },
  { teamId: "nyk", teamName: "New York Knicks", wins: 50, losses: 32, conferenceRank: 2, pointsPerGame: 115, pointsAllowedPerGame: 106 },
  { teamId: "okc", teamName: "Oklahoma City Thunder", wins: 58, losses: 24, conferenceRank: 1, pointsPerGame: 118, pointsAllowedPerGame: 112 },
];

describe("team standings", () => {
  it("ranks offense high-to-low and defense low-to-high", () => {
    expect(calculateTeamMetricRankings("nyk", stats)).toEqual({
      record: 3,
      conference: 2,
      pointsPerGame: 3,
      pointsAllowedPerGame: 1,
      pointDifferential: 2,
      leagueSize: 3,
    });
  });

  it("builds conference standings with team presentation data", () => {
    const standings = buildTeamStandings(teams, stats);
    expect(standings.find((row) => row.teamId === "bos")).toMatchObject({ conference: "Eastern", conferenceRank: 1, pointDifferential: 11 });
    expect(standings.find((row) => row.teamId === "okc")).toMatchObject({ conference: "Western", conferenceRank: 1 });
  });
});

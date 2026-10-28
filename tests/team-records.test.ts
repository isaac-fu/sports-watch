import { describe, expect, it } from "vitest";
import { currentTeamRecords } from "@/lib/team-records";
import type { TeamStat } from "@/lib/models";

const row: TeamStat = { teamId: "okc", teamName: "Thunder", season: 2026, wins: 3, losses: 0, conferenceRank: 1, pointsPerGame: 120, pointsAllowedPerGame: 100 };

describe("current-season team records", () => {
  it("uses current wins and losses, including an explicit 0–0", () => {
    expect(currentTeamRecords({ season: 2026, teams: [row] }, 2026)).toEqual({ okc: "3–0" });
    expect(currentTeamRecords({ season: 2026, teams: [{ ...row, wins: 0 }] }, 2026)).toEqual({ okc: "0–0" });
  });
  it("never relabels a previous-season fallback as current", () => {
    expect(currentTeamRecords({ season: 2025, teams: [{ ...row, season: 2025, wins: 68 }] }, 2026)).toEqual({});
    expect(currentTeamRecords({ season: 2026, teams: [{ ...row, season: 2025 }] }, 2026)).toEqual({});
  });
  it("does not invent zero records for missing or invalid standings", () => {
    expect(currentTeamRecords({ season: 2026, teams: [] }, 2026)).toEqual({});
    expect(currentTeamRecords({ season: 2026, teams: [{ ...row, wins: NaN }] }, 2026)).toEqual({});
  });
});

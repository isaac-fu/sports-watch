import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player, Team } from "@/lib/models";
import { BallDontLieStatsProvider } from "@/lib/providers/stats-provider";

const warriors: Team = {
  id: "gsw",
  name: "Golden State Warriors",
  short: "GSW",
  color: "#f3b942",
  record: "—",
  providerIds: { balldontlie: "10" },
};

const curry: Player = {
  id: "stephen-curry",
  name: "Stephen Curry",
  teamId: "gsw",
  teamName: "Golden State Warriors",
  position: "Guard",
  initials: "SC",
  color: "#f3b942",
  providerIds: { balldontlie: "115" },
};

const providerPlayer = {
  id: 115,
  first_name: "Stephen",
  last_name: "Curry",
  position: "G",
  draft_year: 2026,
  team: { id: 10, full_name: "Golden State Warriors", abbreviation: "GSW" },
};

describe("BALLDONTLIE stats provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fills the last ten from the previous season when the new season has not started", async () => {
    const statsRequests: URL[] = [];
    const gameStats = Array.from({ length: 10 }, (_, index) => ({
      id: 900 + index,
      min: "34",
      fgm: 9,
      fga: 18,
      fg3m: 4,
      fg3a: 9,
      ftm: 5,
      fta: 6,
      reb: 5,
      ast: 7,
      stl: 1,
      blk: 0,
      turnover: 2,
      pts: 27 + index,
      plus_minus: index - 3,
      player: providerPlayer,
      team: providerPlayer.team,
      game: {
        id: 500 + index,
        date: `2026-04-${String(20 - index).padStart(2, "0")}`,
        season: 2025,
        home_team_id: 10,
        visitor_team_id: 14,
        home_team_score: 118,
        visitor_team_score: 110,
        visitor_team: { id: 14, full_name: "Los Angeles Lakers", abbreviation: "LAL" },
      },
    }));

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/players/115")) return Response.json({ data: providerPlayer });
      if (url.pathname.endsWith("/season_averages/general")) {
        return Response.json({ data: [{ player: providerPlayer, team: providerPlayer.team, stats: { gp: 1, pts: 30, reb: 5, ast: 7, stl: 1, blk: 0, tov: 2, fg_pct: .48, fg3_pct: .42, ft_pct: .833 } }] });
      }
      if (url.pathname.endsWith("/stats")) {
        statsRequests.push(url);
        if (!url.searchParams.has("cursor")) return Response.json({ data: gameStats.slice(0, 6), meta: { next_cursor: 906 } });
        return Response.json({ data: gameStats.slice(6), meta: {} });
      }
      return Response.json({ data: [] });
    }));

    const provider = new BallDontLieStatsProvider("test-key", "https://example.test/v1");
    const profile = await provider.getPlayerProfile(curry, 2026);

    expect(profile.lastTenGames).toHaveLength(10);
    expect(profile.lastTenGames[0].freeThrows).toBe("5-6");
    expect(profile.currentSeason?.freeThrowPercentage).toBe(83.3);
    expect(profile.lastTenGames.every((game) => game.season === 2025)).toBe(true);
    expect(profile.lastTenGames[0]).toMatchObject({ opponentShort: "LAL", result: "W", points: 27 });
    expect(statsRequests[0].searchParams.getAll("seasons[]")).toEqual(["2026", "2025"]);
    expect(statsRequests[1].searchParams.get("cursor")).toBe("906");
  });

  it("combines team averages, opponent averages, and standings", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/team_season_averages/general")) {
        const stats = url.searchParams.get("type") === "opponent"
          ? { pts: 109.4 }
          : { w: 52, l: 30, pts: 117.8 };
        return Response.json({ data: [{ team: providerPlayer.team, season: 2026, stats }] });
      }
      if (url.pathname.endsWith("/standings")) {
        return Response.json({ data: [{ team: providerPlayer.team, conference_rank: 3, wins: 52, losses: 30 }] });
      }
      return Response.json({ data: [] });
    }));

    const provider = new BallDontLieStatsProvider("test-key", "https://example.test/v1");
    await expect(provider.getTeamStats(warriors, 2026)).resolves.toMatchObject({
      teamId: "gsw",
      season: 2026,
      wins: 52,
      losses: 30,
      conferenceRank: 3,
      pointsPerGame: 117.8,
      pointsAllowedPerGame: 109.4,
    });
  });
});

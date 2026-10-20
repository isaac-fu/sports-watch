import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player, PlayerProfile, Team } from "@/lib/models";
import { NbaApiProvider } from "@/lib/providers/nba-api-provider";

const warriors: Team = {
  id: "gsw",
  name: "Golden State Warriors",
  short: "GSW",
  color: "#f3b942",
  record: "—",
  providerIds: { nba_api: "1610612744" },
};

const curry: Player = {
  id: "stephen-curry",
  name: "Stephen Curry",
  teamId: "gsw",
  teamName: "Golden State Warriors",
  position: "Guard",
  initials: "SC",
  color: "#f3b942",
  providerIds: { nba_api: "201939" },
};

describe("nba_api service adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends canonical identities to the cached season ingestion service", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://nba.test/v1/season-stats");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ season: 2026 });
      expect(body.teams).toEqual(expect.arrayContaining([expect.objectContaining({ id: "gsw" })]));
      expect(body.players).toEqual(expect.arrayContaining([expect.objectContaining({ id: "stephen-curry" })]));
      return Response.json({
        players: [{ playerId: "stephen-curry", playerName: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", gamesPlayed: 3, pointsPerGame: 29.7, reboundsPerGame: 5.1, assistsPerGame: 6.4, fieldGoalPercentage: 48.1, threePointPercentage: 42.2 }],
        teams: [{ teamId: "gsw", teamName: "Golden State Warriors", season: 2026, wins: 2, losses: 1, conferenceRank: 4, pointsPerGame: 118.2, pointsAllowedPerGame: 112.3 }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NbaApiProvider({ baseUrl: "http://nba.test/", timeoutMs: 5_000 });
    const result = await provider.getSeasonStats(2026);

    expect(result.players[0]).toMatchObject({ playerId: "stephen-curry", pointsPerGame: 29.7 });
    expect(result.teams[0]).toMatchObject({ teamId: "gsw", wins: 2 });
  });

  it("returns player profiles with prior-season games intact", async () => {
    const profile: PlayerProfile = {
      player: curry,
      bio: { height: "6-2", jerseyNumber: "30" },
      currentSeason: null,
      career: null,
      seasons: [],
      lastTenGames: [{ id: "nba-api-1-201939", gameId: "nba-1", date: "2026-04-12", season: 2025, opponentName: "Los Angeles Lakers", opponentShort: "LAL", homeAway: "home", result: "W", score: "119-113", minutes: "35", points: 31, rebounds: 5, assists: 8, steals: 1, blocks: 0, turnovers: 3, fieldGoals: "11-22", threePointers: "6-13", plusMinus: 9 }],
      source: "nba_api",
      updatedAt: "2026-10-18T00:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(profile)));

    const provider = new NbaApiProvider({ baseUrl: "http://nba.test" });
    const result = await provider.getPlayerProfile(curry, 2026);

    expect(result.source).toBe("nba_api");
    expect(result.lastTenGames[0]).toMatchObject({ season: 2025, opponentShort: "LAL", score: "119-113" });
  });

  it("loads canonical NBA IDs through the catalog endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      teams: [{ providerId: "1610612744", name: warriors.name, short: warriors.short }],
      players: [{ providerId: "201939", name: curry.name, position: "", teamProviderId: "1610612744" }],
    })));

    const provider = new NbaApiProvider({ baseUrl: "http://nba.test" });
    const catalog = await provider.getCatalogIdentities();

    expect(catalog.teams[0].providerId).toBe("1610612744");
    expect(catalog.players[0].providerId).toBe("201939");
  });

  it("loads standings with the season selected by the service fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      season: 2025,
      teams: [{ teamId: "gsw", teamName: warriors.name, season: 2025, wins: 48, losses: 34, conferenceRank: 6, pointsPerGame: 113.8, pointsAllowedPerGame: 112.1 }],
    })));

    const provider = new NbaApiProvider({ baseUrl: "http://nba.test" });
    const result = await provider.getTeamStandings(2026);

    expect(result).toMatchObject({ season: 2025, teams: [expect.objectContaining({ teamId: "gsw", wins: 48 })] });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { BallDontLieProvider } from "@/lib/providers/balldontlie-provider";
import { BallDontLieStatsProvider } from "@/lib/providers/stats-provider";
import { NbaApiProvider } from "@/lib/providers/nba-api-provider";
import { emptyBoxScore } from "@/lib/box-score";
import type { Game } from "@/lib/models";

const team = (id: number, abbreviation: string) => ({ id, abbreviation, full_name: abbreviation });
const row = (id: number) => ({ id, date: "2026-04-12", status: "Final", home_team_score: 113, visitor_team_score: 108, home_team: team(10, "GSW"), visitor_team: team(14, "LAL") });
const game: Game = { id: "bdl-42", date: "2026-04-12", time: "Final", status: "final", network: "NBA", venue: "Arena", home: { id: "gsw", short: "GSW", name: "Warriors", color: "blue", record: "" }, away: { id: "lal", short: "LAL", name: "Lakers", color: "gold", record: "" } };

describe("historical games and box scores", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to a one-week schedule instead of fetching half a season", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input);
      const from = Date.parse(url.searchParams.get("start_date")!);
      const to = Date.parse(url.searchParams.get("end_date")!);
      expect(to - from).toBe(7 * 86_400_000);
      return Response.json({ data: [] });
    }));
    await new BallDontLieProvider("test").getGames();
  });

  it("maps game-specific free throws made independently of attempts", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      expect(new URL(input).searchParams.get("game_ids[]")).toBe("42");
      return Response.json({ data: [4, 0, undefined].map((ftm, index) => ({ team: team(10, "GSW"), player: { id: index, first_name: "Test", last_name: String(index) }, ftm })) });
    }));
    const box = await new BallDontLieStatsProvider("test").getBoxScore(game);
    expect(box.teams.flatMap((team) => team.players).map((player) => player.freeThrowsMade)).toEqual([4, 0, null]);
  });

  it("recognizes live quarter and halftime labels without status_state and preserves finals", async () => {
    const statuses = ["1st Qtr", "Halftime", "4th Qtr", "OT", "Final/OT", "7:00 pm ET"];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [
      ...statuses.map((status, index) => ({ ...row(index), status, time: "3:44" })),
      { ...row(10), status: "4th Qtr", status_state: "suspended" },
      { ...row(11), status: "Playing", status_state: "in_progress", time: "2:01" },
    ] })));
    const games = await new BallDontLieProvider("test").getGames();
    expect(games.map((game) => game.status)).toEqual(["live", "live", "live", "live", "final", "scheduled", "scheduled", "live"]);
    expect(games[0].clock).toBe("3:44");
    expect(games[7].clock).toBe("2:01");
  });

  it("loads all historical pages, preserves the date range, and removes duplicate games", async () => {
    const fetcher = vi.fn(async (input: string) => {
      const url = new URL(input);
      expect(url.searchParams.get("start_date")).toBe("2026-04-01");
      expect(url.searchParams.get("end_date")).toBe("2026-04-30");
      return Response.json(url.searchParams.has("cursor") ? { data: [row(1), row(2)] } : { data: [row(1)], meta: { next_cursor: 100 } });
    });
    vi.stubGlobal("fetch", fetcher);
    const games = await new BallDontLieProvider("test").getGames({ from: "2026-04-01", to: "2026-04-30" });
    expect(games.map((item) => item.id)).toEqual(["bdl-1", "bdl-2"]);
    expect(games[0]).toMatchObject({ status: "final", homeScore: 113, awayScore: 108 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects repeated cursors instead of returning an incomplete calendar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [row(1)], meta: { next_cursor: 100 } })));
    await expect(new BallDontLieProvider("test").getGames()).rejects.toThrow("repeated cursor");
  });

  it("passes date and both canonical teams to resolve a different provider's game ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toBe("http://nba.test/v1/box-score");
      expect(JSON.parse(String(init?.body)).game).toEqual(game);
      return Response.json({ ...emptyBoxScore(game, "nba_api"), status: "available" });
    }));
    const box = await new NbaApiProvider({ baseUrl: "http://nba.test" }).getBoxScore(game);
    expect(box.gameId).toBe("bdl-42");
  });

  it("rejects a box score for a different game", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...emptyBoxScore(game, "nba_api"), gameId: "another-game" })));
    await expect(new NbaApiProvider().getBoxScore(game)).rejects.toThrow("invalid box score");
  });

  it("distinguishes future games from unavailable final-game statistics", () => {
    expect(emptyBoxScore({ ...game, status: "scheduled" }, "nba_api").status).toBe("pending");
    expect(emptyBoxScore(game, "nba_api")).toMatchObject({ status: "unavailable", teams: [] });
  });
});

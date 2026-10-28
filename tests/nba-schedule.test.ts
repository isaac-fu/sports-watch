import { afterEach, describe, expect, it, vi } from "vitest";
import { NbaApiProvider } from "@/lib/providers/nba-api-provider";
import { canonicalTeams } from "@/lib/catalog";
afterEach(() => vi.unstubAllGlobals());
describe("native NBA schedule identities", () => {
  const provider = new NbaApiProvider({ baseUrl: "http://nba.test" });
  const home = canonicalTeams[0], away = canonicalTeams[1];
  const game = { id: "nba-0022600001", home, away, status: "final" };
  it("passes canonical teams and date bounds without calling BALLDONTLIE", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(url).toBe("http://nba.test/v1/team-games");
      expect(JSON.parse(init.body)).toMatchObject({ teamId: home.id, from: "2026-09-01", to: "2026-11-01", teams: expect.any(Array) });
      return Response.json([game]);
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider.getTeamGames(home, "2026-09-01", "2026-11-01")).toEqual([game]);
  });
  it("resolves native game IDs and rejects mismatched provider results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(game)));
    expect(await provider.getGame(game.id)).toEqual(game);
    expect(await provider.getGame("bdl-1")).toBeNull();
    await expect(provider.getGame("nba-0022600002")).rejects.toThrow("invalid game");
  });
  it("rejects foreign team fixtures and never requests play-by-play", async () => {
    const fetchMock = vi.fn(async () => Response.json([game]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.getTeamGames(canonicalTeams[2], "2026-09-01", "2026-11-01")).rejects.toThrow("invalid team games");
    fetchMock.mockClear();
    await expect(provider.getGameEvents(game.id)).rejects.toThrow("not available");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

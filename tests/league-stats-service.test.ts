import { beforeEach, describe, expect, it, vi } from "vitest";
const stats = vi.hoisted(() => vi.fn());
vi.mock("@/lib/catalog-repository", () => ({ loadCatalog: vi.fn(async () => undefined) }));
vi.mock("@/lib/providers", () => ({ getStatsProvider: () => ({ name: "nba_api", getSeasonStats: stats }) }));
beforeEach(() => { vi.resetModules(); stats.mockReset(); });
describe("shared leaderboard snapshot", () => {
  it("coalesces requests and reuses statistics without one request per player", async () => {
    stats.mockResolvedValue({ players: [], teams: [{ season: 2025 }, { season: 2026 }] });
    const { getLeagueStats } = await import("@/lib/league-stats-service");
    const [a, b] = await Promise.all([getLeagueStats(2026), getLeagueStats(2026)]);
    expect(a).toEqual(b);
    expect(a.teams).toEqual([{ season: 2026 }]);
    await getLeagueStats(2026);
    expect(stats).toHaveBeenCalledTimes(1);
  });
  it("does not replace failed live data with mock statistics", async () => {
    stats.mockRejectedValue(new Error("provider unavailable"));
    const { getLeagueStats } = await import("@/lib/league-stats-service");
    await expect(getLeagueStats(2026)).rejects.toThrow("provider unavailable");
  });
});

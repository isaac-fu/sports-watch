import { describe, expect, it } from "vitest";
import { filterGamesByTeamScope, gameIncludesFollowedTeam, upcomingGamesForDay } from "@/lib/game-filter";

const games = [
  { id: "gsw-lal", homeId: "gsw", awayId: "lal" },
  { id: "bos-nyk", homeId: "bos", awayId: "nyk" },
  { id: "den-phx", homeId: "den", awayId: "phx" },
];

describe("game team scope filters", () => {
  it("shows every upcoming game that day in tip-off order without a two-game cap", () => {
    const slate = [21, 19, 20, 18].map((hour) => ({ id: String(hour), date: "2026-10-26", startsAt: `2026-10-26T${hour}:00:00Z`, time: "TBD", status: "scheduled" }));
    const other = { ...slate[0], id: "tomorrow", date: "2026-10-27" };
    expect(upcomingGamesForDay([...slate, other, { ...slate[0], id: "final", status: "final" }, { ...slate[0], id: "live", status: "live" }], "2026-10-26").map((game) => game.id)).toEqual(["18", "19", "20", "21"]);
    expect(slate[0].id).toBe("21");
  });

  it("uses the next scheduled day when today is empty and excludes past dates", () => {
    const slate = ["2026-10-25", "2026-10-28", "2026-10-27", "2026-10-27"].map((date) => ({ date, time: "7:00 PM", status: "scheduled" }));
    expect(upcomingGamesForDay(slate, "2026-10-26").map((game) => game.date)).toEqual(["2026-10-27", "2026-10-27"]);
    expect(upcomingGamesForDay([], "2026-10-26")).toEqual([]);
  });

  it("keeps every game in the default all-games scope", () => {
    expect(filterGamesByTeamScope(games, ["gsw"], "all").map((game) => game.id)).toEqual([
      "gsw-lal",
      "bos-nyk",
      "den-phx",
    ]);
  });

  it("keeps games where a followed team is home or away", () => {
    expect(filterGamesByTeamScope(games, ["lal", "nyk"], "following").map((game) => game.id)).toEqual([
      "gsw-lal",
      "bos-nyk",
    ]);
    expect(gameIncludesFollowedTeam(games[0], ["lal"])).toBe(true);
  });

  it("returns an empty list when following is selected without followed teams", () => {
    expect(filterGamesByTeamScope(games, [], "following")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { searchPlayers, searchTeams } from "@/lib/entity-search";

const teams = [
  { id: "gsw", name: "Golden State Warriors", short: "GSW" },
  { id: "nyk", name: "New York Knicks", short: "NYK" },
];

const players = [
  { id: "curry", name: "Stephen Curry", teamName: "Golden State Warriors", position: "Guard" },
  { id: "doncic", name: "Luka Dončić", teamName: "Los Angeles Lakers", position: "Guard" },
  { id: "jokic", name: "Nikola Jokić", teamName: "Denver Nuggets", position: "Center" },
];

describe("catalog entity search", () => {
  it("finds teams by name or abbreviation", () => {
    expect(searchTeams(teams, "golden warriors").map((team) => team.id)).toEqual(["gsw"]);
    expect(searchTeams(teams, "nyk").map((team) => team.id)).toEqual(["nyk"]);
  });

  it("finds players by name, team, or position", () => {
    expect(searchPlayers(players, "warriors guard").map((player) => player.id)).toEqual(["curry"]);
    expect(searchPlayers(players, "center").map((player) => player.id)).toEqual(["jokic"]);
  });

  it("matches names without requiring accents", () => {
    expect(searchPlayers(players, "doncic").map((player) => player.id)).toEqual(["doncic"]);
    expect(searchPlayers(players, "jokic").map((player) => player.id)).toEqual(["jokic"]);
  });

  it("keeps the original ordering for an empty query", () => {
    expect(searchPlayers(players, "")).toEqual(players);
  });
});

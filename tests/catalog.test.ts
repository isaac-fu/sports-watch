import { describe, expect, it } from "vitest";
import { canonicalPlayers, canonicalTeams, findPlayerByProviderId, findTeamByProviderId, getCatalog, mergeProviderId, reconcileProviderCatalog } from "@/lib/catalog";

describe("canonical catalog", () => {
  it("exposes one shared team/player catalog with provider metadata", () => {
    const catalog = getCatalog();
    expect(catalog.teams).toBe(canonicalTeams);
    expect(catalog.players).toBe(canonicalPlayers);
    expect(catalog.teams).toHaveLength(10);
    expect(catalog.players).toHaveLength(12);
    expect(catalog.teams.every((team) => team.providerIds?.espn)).toBe(true);
    expect(catalog.players.every((player) => player.providerIds?.espn)).toBe(true);
  });

  it("resolves canonical entities by provider identity", () => {
    expect(findTeamByProviderId("espn", "9")?.id).toBe("gsw");
    expect(findPlayerByProviderId("espn", "3975")?.id).toBe("stephen-curry");
  });

  it("adds a provider identity without changing the canonical id", () => {
    const team = canonicalTeams[0];
    const mapped = mergeProviderId(team, "balldontlie", "10");
    expect(mapped.id).toBe(team.id);
    expect(mapped.providerIds).toMatchObject({ espn: "9", balldontlie: "10" });
    expect(team.providerIds).not.toHaveProperty("balldontlie");
  });

  it("reconciles provider entities while preserving stable ids and curated images", () => {
    const catalog = reconcileProviderCatalog("balldontlie", {
      teams: [
        { providerId: "10", name: "Golden State Warriors", short: "GSW" },
        { providerId: "14", name: "Los Angeles Lakers", short: "LAL" },
      ],
      players: [
        { providerId: "115", name: "Stephen Curry", position: "G", teamProviderId: "10" },
        { providerId: "132", name: "Luka Doncic", position: "G-F", teamProviderId: "14" },
      ],
    });

    const curry = catalog.players.find((player) => player.id === "stephen-curry");
    const luka = catalog.players.find((player) => player.id === "luka-doncic");
    expect(curry?.providerIds?.balldontlie).toBe("115");
    expect(curry?.imageUrl).toContain("3975.png");
    expect(luka).toMatchObject({ teamId: "lal", teamName: "Los Angeles Lakers", position: "Guard / Forward" });
    expect(catalog.teams.find((team) => team.id === "gsw")?.providerIds?.balldontlie).toBe("10");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { BallDontLieProvider } from "@/lib/providers/balldontlie-provider";

describe("BALLDONTLIE catalog provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads teams and follows active-player cursors", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.endsWith("/teams")) {
        return Response.json({ data: [
          { id: 10, full_name: "Golden State Warriors", abbreviation: "GSW" },
          { id: 14, full_name: "Los Angeles Lakers", abbreviation: "LAL" },
        ] });
      }
      if (url.includes("cursor=100")) {
        return Response.json({ data: [
          { id: 132, first_name: "Luka", last_name: "Doncic", position: "G-F", team: { id: 14, abbreviation: "LAL", full_name: "Los Angeles Lakers" } },
        ], meta: { per_page: 100 } });
      }
      return Response.json({ data: [
        { id: 115, first_name: "Stephen", last_name: "Curry", position: "G", team: { id: 10, abbreviation: "GSW", full_name: "Golden State Warriors" } },
      ], meta: { next_cursor: 100, per_page: 100 } });
    }));

    const provider = new BallDontLieProvider("test-key", "https://example.test/v1");
    const catalog = await provider.getCatalogIdentities();

    expect(catalog.teams).toHaveLength(2);
    expect(catalog.players).toEqual([
      { providerId: "115", name: "Stephen Curry", position: "G", teamProviderId: "10" },
      { providerId: "132", name: "Luka Doncic", position: "G-F", teamProviderId: "14" },
    ]);
    expect(requestedUrls.some((url) => url.includes("/players/active?per_page=100"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("cursor=100"))).toBe(true);
  });
});

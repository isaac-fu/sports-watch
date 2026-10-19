import { describe, expect, it } from "vitest";
import { mergeNewsArticles } from "@/lib/news-cache";
import type { NewsArticle } from "@/lib/models";

const article = (id: string, publishedAt: string, url = `https://example.com/${id}`): NewsArticle => ({
  id,
  title: id,
  summary: `${id} summary`,
  source: "Test Wire",
  publishedAt,
  url,
  teamIds: ["gsw"],
  playerIds: [],
  tags: ["storyline"],
});

describe("news cache merging", () => {
  it("retains cached stories, updates duplicates, and sorts newest first", () => {
    const cached = [article("cached", "2026-10-18T08:00:00.000Z"), article("updated", "2026-10-18T09:00:00.000Z")];
    const fresh = [article("new", "2026-10-18T11:00:00.000Z"), article("updated", "2026-10-18T10:00:00.000Z")];
    const merged = mergeNewsArticles(fresh, cached);
    expect(merged.map((item) => item.id)).toEqual(["new", "updated", "cached"]);
    expect(merged.find((item) => item.id === "updated")?.publishedAt).toBe("2026-10-18T10:00:00.000Z");
  });
});

import { describe, expect, it } from "vitest";
import type { NewsArticle } from "@/lib/models";
import { groupNewsStories, sameNewsEvent, selectStoryArticles } from "@/lib/news-stories";
import { rankCatchUpCandidates, rankNewsCandidates } from "@/lib/recommendations/rankers";
import type { NewsCandidate } from "@/lib/recommendations/types";

// Synthetic, labeled examples based on the requested scenarios, not quotations.
const article = (id: string, title: string, changes: Partial<NewsArticle> = {}): NewsArticle => ({ id, title, summary: "Stephen Curry scored 44 points against the Minnesota Timberwolves in a Warriors victory.", playerIds: ["curry"], teamIds: ["gsw", "min"], source: "Example", url: `https://example.com/${id}`, tags: ["performance"], publishedAt: "2026-11-01T12:00:00Z", ...changes });
const candidate = (article: NewsArticle): NewsCandidate => ({ article, matchedPlayers: [], matchedTeams: [], freshnessHours: 0, importanceScore: 10, sourceQualityScore: 6, savedInterestScore: 0, sources: ["popular-league-update"] });
describe("news story grouping", () => {
  it("groups paraphrased coverage of one performance and preserves IDs across syncs", () => {
    const a = article("a", "Curry scores 44 points against Timberwolves");
    const b = article("b", "Curry drops 44 points against Minnesota Timberwolves", { publishedAt: "2026-11-01T14:00:00Z" });
    const grouped = groupNewsStories([b, a]);
    expect(grouped[0].storyId).toBe(grouped[1].storyId);
    expect(groupNewsStories([b], grouped)[0].storyId).toBe(grouped[0].storyId);
    expect(rankNewsCandidates(grouped.map(candidate))).toHaveLength(1);
    expect(rankCatchUpCandidates(grouped.map(candidate))).toHaveLength(1);
  });
  it("keeps distinct events, opponents, numbers, and later games separate", () => {
    const a = article("a", "Curry scores 44 points against Timberwolves");
    for (const b of [article("b", "Curry signs contract extension"), article("c", "Curry scores 40 points against Timberwolves"), article("d", a.title, { teamIds: ["gsw", "lal"] }), article("e", a.title, { publishedAt: "2026-11-08T12:00:00Z" })]) expect(sameNewsEvent(a, b)).toBe(false);
  });
  it("keeps meaningful injury developments separate", () => {
    const a = article("a", "Porzingis steps away from basketball", { playerIds: ["porzingis"], tags: ["injury"] });
    expect(sameNewsEvent(a, { ...a, id: "b", title: "Porzingis announces return date to basketball" })).toBe(false);
    expect(sameNewsEvent(a, { ...a, id: "c", title: "Porzingis receives injury diagnosis" })).toBe(false);
  });
  it("does not promote an equal-quality repeat just because it is newer", () => {
    const a = article("a", "Curry scores 44 points against Timberwolves", { storyId: "same" });
    const b = { ...a, id: "b", publishedAt: "2026-11-02T12:00:00Z" };
    expect(selectStoryArticles([b, a], (item) => item, () => 0)[0].id).toBe("a");
    expect(selectStoryArticles([a, { ...b, url: "https://www.nba.com/news/curry" }], (item) => item, () => 0)[0].id).toBe("b");
  });
});

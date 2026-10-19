import { describe, expect, it } from "vitest";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { generateNewsCandidates } from "@/lib/recommendations/candidate-generators";
import { getPersonalizedFeed } from "@/lib/recommendations/service";
import { rankAlertCandidates, rankNewsCandidates } from "@/lib/recommendations/rankers";
import type { AlertCandidate, NewsArticle, Preferences } from "@/lib/models";

const preferences: Preferences = {
  followedTeamIds: ["gsw"],
  followedPlayerIds: ["stephen-curry"],
  alerts: { gameStarting: true, closeGame: true, finalScore: true, standoutPerformance: true, injuryUpdate: true, leadChange: true, milestone: true },
};

describe("recommendation ranking", () => {
  it("prioritizes stories matching canonical teams and players", () => {
    const articles: NewsArticle[] = [
      { id: "unrelated", title: "League update", summary: "A general update.", source: "League Wire", publishedAt: new Date().toISOString(), url: "https://example.com/unrelated", teamIds: ["nyk"], playerIds: ["jalen-brunson"], tags: ["storyline"] },
      { id: "curry", title: "Curry takes over late", summary: "A standout finish.", source: "Courtside Stats", publishedAt: new Date().toISOString(), url: "https://example.com/curry", teamIds: ["gsw"], playerIds: ["stephen-curry"], tags: ["performance"] },
    ];
    const candidates = generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences);
    const ranked = rankNewsCandidates(candidates);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe("curry");
    expect(ranked[0].reason).toContain("Stephen Curry");
  });

  it("always puts the newest matching story first", () => {
    const articles: NewsArticle[] = [
      { id: "older-player-story", title: "Curry scores 40", summary: "A major performance.", source: "Courtside Stats", publishedAt: "2026-10-18T08:00:00.000Z", url: "https://example.com/older", teamIds: ["gsw"], playerIds: ["stephen-curry"], tags: ["performance"] },
      { id: "newer-team-story", title: "Warriors update", summary: "The latest team update.", source: "League Wire", publishedAt: "2026-10-18T10:00:00.000Z", url: "https://example.com/newer", teamIds: ["gsw"], playerIds: [], tags: ["storyline"] },
    ];
    const ranked = rankNewsCandidates(generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences));
    expect(ranked.map((item) => item.id)).toEqual(["newer-team-story", "older-player-story"]);
  });

  it("infers a unique player surname and that player's team from article text", () => {
    const article: NewsArticle = {
      id: "surname-only",
      title: "Curry erupts late",
      summary: "A decisive fourth-quarter performance.",
      source: "NBA Wire",
      publishedAt: "2026-10-19T09:00:00.000Z",
      url: "https://example.com/surname-only",
      teamIds: [],
      playerIds: [],
      tags: ["performance"],
    };
    const feed = getPersonalizedFeed(preferences, [article]);
    expect(feed[0]).toMatchObject({ id: "surname-only", teamIds: ["gsw"], playerIds: ["stephen-curry"] });
    expect(feed[0].reason).toContain("Stephen Curry");
  });

  it("falls back to current league stories when no article matches a followed entity", () => {
    const articles: NewsArticle[] = [
      { id: "league-story", title: "League-wide update", summary: "The latest NBA news.", source: "League Wire", publishedAt: "2026-10-19T10:00:00.000Z", url: "https://example.com/league", teamIds: ["bos"], playerIds: ["jayson-tatum"], tags: ["nba"] },
    ];
    const feed = getPersonalizedFeed(preferences, articles);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ id: "league-story", reason: "Popular across recent NBA coverage" });
  });

  it("backfills a sparse personalized feed with recent popular NBA stories", () => {
    const now = Date.now();
    const articles: NewsArticle[] = [
      { id: "followed-story", title: "Warriors rotation update", summary: "Golden State changes the lineup.", source: "NBA Wire", publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), url: "https://example.com/followed", teamIds: ["gsw"], playerIds: [], tags: ["nba"] },
      { id: "popular-story", title: "Celtics make a roster move", summary: "Boston updates its NBA roster.", source: "NBA Wire", publishedAt: new Date(now - 60 * 60 * 1000).toISOString(), url: "https://example.com/popular", teamIds: ["bos"], playerIds: [], tags: ["nba", "roster"] },
    ];
    const feed = getPersonalizedFeed(preferences, articles);
    expect(feed.map((item) => item.id)).toEqual(["popular-story", "followed-story"]);
    expect(feed[0].reason).toBe("Popular across recent NBA coverage");
    expect(feed[1].reason).toContain("Golden State Warriors");
  });

  it("does not promote unrelated basketball coverage as NBA news", () => {
    const article: NewsArticle = {
      id: "college-only",
      title: "College basketball recruiting roundup",
      summary: "The latest NCAA commitments.",
      source: "College Wire",
      publishedAt: "2026-10-19T10:00:00.000Z",
      url: "https://example.com/college",
      teamIds: [],
      playerIds: [],
      tags: ["nba"],
    };
    expect(getPersonalizedFeed({ ...preferences, followedTeamIds: [], followedPlayerIds: [] }, [article])).toEqual([]);
  });

  it("keeps alert ranking bounded and deterministic", () => {
    const candidates: AlertCandidate[] = Array.from({ length: 25 }, (_, index) => ({
      candidateId: `alert-${index}`,
      type: index % 2 === 0 ? "closeGame" : "finalScore",
      title: `Alert ${index}`,
      body: "Important update",
      priority: index,
      occurredAt: new Date(2026, 0, 1, 0, index).toISOString(),
      teamIds: ["gsw"],
      playerIds: [],
    }));
    const ranked = rankAlertCandidates(candidates);
    expect(ranked).toHaveLength(20);
    expect(ranked[0].candidateId).toBe("alert-24");
    expect(ranked.at(-1)?.candidateId).toBe("alert-5");
  });
});

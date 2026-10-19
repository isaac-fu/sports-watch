import { describe, expect, it } from "vitest";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { generateNewsCandidates } from "@/lib/recommendations/candidate-generators";
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

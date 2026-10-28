import { describe, expect, it } from "vitest";
import { boxScoreHighlights } from "@/lib/box-score-highlights";
import { createDefaultPreferences } from "@/lib/store";
import { canonicalTeams, canonicalPlayers } from "@/lib/catalog";
import type { Game, NewsArticle } from "@/lib/models";
import type { BoxScoreLine, GameBoxScore } from "@/lib/box-score";
import { applyNewsFeedback, classifyNewsTopics, newsFeedbackAdjustment, newsFeedbackSignals } from "@/lib/news-feedback";
import { generateNewsCandidates } from "@/lib/recommendations/candidate-generators";
import { rankCatchUpCandidates, rankNewsCandidates } from "@/lib/recommendations/rankers";
import { getCatchUpBrief, getPersonalizedFeed } from "@/lib/recommendations/service";
import { contrastRatio, createAccentPalette, normalizeHex } from "@/lib/theme-colors";

const preferences = createDefaultPreferences(false);
const game: Game = { id: "nba-0022600001", home: canonicalTeams[0], away: canonicalTeams[1], date: "2026-10-27", time: "Final", network: "NBA", venue: "Arena", status: "final", homeScore: 120, awayScore: 110 };
const line = (name: string, values: Partial<BoxScoreLine>): BoxScoreLine => ({ name, playerId: name, minutes: "30", points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0, fieldGoals: null, threePointers: null, freeThrows: null, freeThrowsMade: null, plusMinus: null, ...values });
const box = (...players: BoxScoreLine[]): GameBoxScore => ({ gameId: game.id, source: "nba_api", status: "available", updatedAt: new Date().toISOString(), teams: [{ teamId: game.home.id, name: game.home.name, players, totals: null }] });
const article = (id: string, title: string): NewsArticle => ({ id, title, summary: "The latest NBA update.", source: "NBA Wire", publishedAt: new Date().toISOString(), url: `https://example.com/${id}`, teamIds: [], playerIds: [], tags: ["nba"] });

describe("box-score catch-up priorities", () => {
  it("puts the result before triple doubles, exceptional scoring, and ordinary leaders", () => {
    const highlights = boxScoreHighlights(game, box(line("Leader", { points: 31 }), line("Triple", { points: 20, rebounds: 10, assists: 12 }), line("Fifty", { points: 55 })), preferences, 4);
    expect(highlights[0]).toMatchObject({ source: "box-score", reason: "Final result" });
    expect(highlights[0].title).toContain("win by 10");
    expect(highlights[0].detail).toContain("120");
    expect(highlights.slice(1).map((item) => item.title.split(":")[0])).toEqual(["Triple", "Fifty", "Leader"]);
  });
  it("prefers double doubles over single-stat performances", () => {
    expect(boxScoreHighlights(game, box(line("Thirty", { points: 35 }), line("Double", { points: 20, rebounds: 10 })), preferences)[1].title).toContain("Double: double-double");
  });
  it("recognizes five-by-five, blocks, steals and high-volume perfect shooting", () => {
    const moments = boxScoreHighlights(game, box(line("Filled", { points: 12, rebounds: 5, assists: 5, steals: 5, blocks: 5 }), line("Shooter", { points: 24, fieldGoals: "8-8" }), line("Defense", { points: 4, blocks: 7 })), preferences, 5);
    expect(moments[1].title).toContain("five-by-five");
    expect(moments.some((m) => m.title.includes("8/8 FG (100%)"))).toBe(true);
    expect(moments.some((m) => m.title.includes("7 blocks"))).toBe(true);
  });
  it("does not promote tiny perfect-shooting samples or low assist leaders", () => {
    const moments = boxScoreHighlights(game, box(line("Top", { points: 25 }), line("Tiny", { points: 2, assists: 6, fieldGoals: "1-1" })), preferences, 10);
    expect(moments.some((m) => m.title.includes("Tiny"))).toBe(false);
    expect(moments[1].title).toContain("game-leading scorer");
  });
  it("only includes assist and rebound leaders above the minimum", () => {
    const moments = boxScoreHighlights(game, box(line("Points", { points: 20 }), line("Passer", { points: 4, assists: 7, rebounds: 7 })), preferences, 10);
    expect(moments[2].title).toContain("team-leading 7 assists");
  });
  it("does not fabricate stats for scheduled games or unavailable boxes", () => {
    expect(boxScoreHighlights({ ...game, status: "scheduled" }, box(line("A", { points: 30 })), preferences)).toEqual([]);
    expect(boxScoreHighlights(game, null, preferences)).toHaveLength(1);
    expect(boxScoreHighlights(game, { ...box(), gameId: "wrong" }, preferences)).toHaveLength(1);
    expect(boxScoreHighlights({ ...game, status: "live" }, box(line("A", { points: 30 })), preferences)[1].detail).toContain("in progress");
  });
  it("fills remaining recap slots with news, never play-by-play", () => {
    const brief = getCatchUpBrief(preferences, [game], [article("news", "NBA trade update")]);
    expect(brief.moments.map((moment) => moment.source)).toEqual(["box-score", "news"]);
  });
});

describe("news-interest learning", () => {
  const betting = article("bet", "NBA player props, odds and best picks");
  it("learns betting as a topic without penalizing unrelated performance stories", () => {
    expect(classifyNewsTopics({ ...betting, summary: "30 points and injury news" })).toEqual(["betting"]);
    const feedback = applyNewsFeedback(undefined, betting, "not-interested");
    expect(newsFeedbackSignals(article("stats", "NBA career high points"), feedback).topicScore).toBe(0);
    const signals = newsFeedbackSignals(article("more", "NBA betting odds"), feedback);
    expect(newsFeedbackAdjustment(signals, "catchup")).toBeLessThan(newsFeedbackAdjustment(signals, "feed"));
  });
  it("does not backfill explicitly rejected stories or disliked betting topics", () => {
    const prefs = { ...preferences, newsFeedback: applyNewsFeedback(undefined, betting, "not-interested") };
    const stories = [betting, article("more", "NBA betting odds"), article("trade", "NBA trade update")];
    expect(getPersonalizedFeed(prefs, stories).map((item) => item.id)).toEqual(["trade"]);
    const candidates = generateNewsCandidates(stories, canonicalTeams, canonicalPlayers, prefs);
    expect(rankCatchUpCandidates(candidates).map((item) => item.id)).toEqual(["trade"]);
  });
  it("reverses a vote without accumulating duplicate votes", () => {
    const feedback = applyNewsFeedback(applyNewsFeedback(undefined, betting, "not-interested"), betting, "interested");
    expect(Object.keys(feedback)).toEqual(["bet"]);
    expect(newsFeedbackSignals(betting, feedback)).toMatchObject({ excluded: false, articleScore: 35, topicScore: 30 });
  });
  it("applies stricter topic suppression to catch-up while keeping feed chronological", () => {
    const negative = article("old", "NBA injury update");
    const stories = [article("new", "NBA injury report"), article("trade", "NBA trades")];
    const prefs = { ...preferences, newsFeedback: applyNewsFeedback(undefined, negative, "not-interested") };
    const candidates = generateNewsCandidates(stories, canonicalTeams, canonicalPlayers, prefs);
    expect(rankNewsCandidates(candidates)).toHaveLength(2);
    expect(rankCatchUpCandidates(candidates).map((item) => item.id)).toEqual(["trade"]);
  });
});

describe("accessible custom accent palette", () => {
  it("validates hex rather than accepting arbitrary CSS", () => {
    expect(normalizeHex("#aBc")).toBe("#aabbcc");
    expect(normalizeHex("red; background:url(x)")).toBeNull();
  });
  it.each(["light", "dark"] as const)("keeps text and buttons readable in %s mode", (theme) => {
    for (const color of ["#000000", "#ffffff", "#ffff00", "#0000ff", "#28a99a", "#ff0000"]) {
      const palette = createAccentPalette(color, theme)!;
      expect(contrastRatio(palette.selected, palette.foreground)).toBeGreaterThanOrEqual(4.5);
      for (const bg of [palette.canvas, palette.panel, palette.raised]) expect(contrastRatio(palette.text, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

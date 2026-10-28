import { afterEach, describe, expect, it, vi } from "vitest";
import { recordNewsFeedback } from "@/lib/news-feedback-repository";
import { getCurrentPreferences, updateCurrentPreferences } from "@/lib/preferences-repository";
import type { NewsArticle } from "@/lib/models";
import { demoAccountId } from "@/lib/store";
afterEach(() => vi.unstubAllEnvs());
describe("news-feedback preference storage", () => {
  const article: NewsArticle = { id: "feedback-test", title: "NBA betting odds", summary: "", tags: ["nba"], source: "Test", url: "https://example.com/test", publishedAt: new Date().toISOString(), teamIds: [], playerIds: [] };
  it("isolates accounts and preserves feedback when ordinary preferences change", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const a = "feedback-account-a", b = "feedback-account-b";
    await recordNewsFeedback(a, article, "not-interested");
    expect((await getCurrentPreferences(b)).newsFeedback).toBeUndefined();
    const prefs = await getCurrentPreferences(a);
    await updateCurrentPreferences(a, { ...prefs, followedTeamIds: ["gsw"], newsFeedback: {} });
    expect((await getCurrentPreferences(a)).newsFeedback?.[article.id]).toEqual({ interest: "not-interested", topics: ["betting"] });
  });
  it("does not mutate the shared demo account", async () => {
    await expect(recordNewsFeedback(demoAccountId, article, "interested")).rejects.toThrow("read-only");
  });
});

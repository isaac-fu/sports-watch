import { describe, expect, it } from "vitest";
import { feedFreshnessLabel } from "@/lib/feed-freshness";

const minute = 60_000;
const refreshedAt = Date.parse("2026-10-19T08:00:00.000Z");

describe("feed freshness labels", () => {
  it.each([
    [0, ""],
    [1, "Feed hasn’t been refreshed for 1 minute."],
    [4, "Feed hasn’t been refreshed for 1 minute."],
    [5, "Feed hasn’t been refreshed for 5 minutes."],
    [10, "Feed hasn’t been refreshed for 10 minutes."],
    [30, "Feed hasn’t been refreshed for 30 minutes."],
    [60, "Feed hasn’t been refreshed for at least 1 hour."],
    [120, "Feed hasn’t been refreshed for at least 1 hour."],
  ])("uses the expected label at %i minutes", (minutes, expected) => {
    expect(feedFreshnessLabel(refreshedAt, refreshedAt + Number(minutes) * minute)).toBe(expected);
  });
});

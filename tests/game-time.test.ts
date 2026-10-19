import { describe, expect, it } from "vitest";
import { formatPacificTipTime, pacificDateKey, scheduledGameTimestamp } from "@/lib/game-time";

describe("Pacific schedule times", () => {
  it("converts an absolute tip time to the Pacific calendar date and display time", () => {
    const startsAt = "2026-10-21T02:30:00.000Z";

    expect(pacificDateKey(startsAt, "2026-10-21")).toBe("2026-10-20");
    expect(formatPacificTipTime(startsAt, "TBD")).toBe("7:30 PM PST");
  });

  it("labels provider fallback times without duplicating an existing Pacific suffix", () => {
    expect(formatPacificTipTime(undefined, "7:00 PM")).toBe("7:00 PM PST");
    expect(formatPacificTipTime(undefined, "7:00 PM PDT")).toBe("7:00 PM PST");
    expect(formatPacificTipTime(undefined, "TBD")).toBe("TBD");
  });

  it("uses the exact provider timestamp for alert scheduling", () => {
    const startsAt = "2026-12-21T03:30:00.000Z";
    expect(scheduledGameTimestamp({ startsAt, date: "2026-12-20", time: "7:30 PM PST" })).toBe(Date.parse(startsAt));
  });
});

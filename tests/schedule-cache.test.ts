import { describe, expect, it, vi } from "vitest";
import { ScheduleCache, scheduleTtlMs } from "@/lib/schedule-cache";

describe("schedule caching", () => {
  it("reuses fresh months and coalesces simultaneous loads", async () => {
    const cache = new ScheduleCache<number>();
    const load = vi.fn(async () => 42);
    await Promise.all([cache.get("april", load, () => 1000), cache.get("april", load, () => 1000)]);
    expect((await cache.get("april", load, () => 1000)).value).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get("may", load, () => 1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("refreshes expired results, retains stale data on failure, and retries", async () => {
    let now = 0;
    const cache = new ScheduleCache<number>(2, () => now);
    await cache.get("a", async () => 1, () => 100);
    now = 100;
    await expect(cache.get("a", async () => { throw new Error("offline"); }, () => 100)).rejects.toThrow("offline");
    expect(cache.peek("a")?.value).toBe(1);
    expect((await cache.get("a", async () => 2, () => 100)).value).toBe(2);
    now += 24 * 60 * 60_000;
    expect(cache.peek("a")).toBeUndefined();
  });

  it("bounds stored months", async () => {
    const cache = new ScheduleCache<number>(2);
    for (const key of ["a", "b", "c"]) await cache.get(key, async () => 1, () => 1000);
    expect(cache.peek("a")).toBeUndefined();
    expect(cache.peek("b")?.value).toBe(1);
  });

  it("keeps current/live games fresh and caches completed history longer", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    const past = { from: "2026-04-01", to: "2026-04-30" };
    expect(scheduleTtlMs(past, [{ status: "final" }], now)).toBe(3_600_000);
    expect(scheduleTtlMs(past, [], now)).toBe(300_000);
    expect(scheduleTtlMs(past, [{ status: "live" }], now)).toBe(30_000);
    expect(scheduleTtlMs({ from: "2026-10-01", to: "2026-11-07" }, [], now)).toBe(30_000);
    expect(scheduleTtlMs({ from: "2026-12-01", to: "2026-12-31" }, [], now)).toBe(300_000);
    expect(scheduleTtlMs({}, [], now)).toBe(30_000);
  });
});

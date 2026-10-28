import { describe, expect, it, vi, afterEach } from "vitest";
import { ProviderBackoff, ProviderRateLimitError, fetchSportsProvider } from "@/lib/provider-backoff";

afterEach(() => vi.unstubAllGlobals());
describe("sports provider backoff", () => {
  it("backs off exponentially and resets on recovery", () => {
    let now = 0;
    const gate = new ProviderBackoff(() => now);
    expect(gate.limited(null).retryAt).toBe(60_000);
    expect(() => gate.check()).toThrow(ProviderRateLimitError);
    now = 60_000;
    expect(() => gate.check()).not.toThrow();
    expect(gate.limited(null).retryAt).toBe(180_000);
    now = 180_000;
    gate.success();
    expect(gate.limited(null).retryAt).toBe(240_000);
  });
  it("honors Retry-After seconds and dates", () => {
    expect(new ProviderBackoff(() => 0).limited("600").retryAt).toBe(600_000);
    expect(new ProviderBackoff(() => 0).limited(new Date(300_000).toUTCString()).retryAt).toBe(300_000);
  });
  it("does not contact the provider again during cooldown, even for a different URL", async () => {
    const fetcher = vi.fn(async () => new Response("Rate limited", { status: 429, headers: { "Retry-After": "120" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchSportsProvider("https://example.test/games", "cooldown-test")).rejects.toThrow(ProviderRateLimitError);
    await expect(fetchSportsProvider("https://example.test/games?from=tomorrow", "cooldown-test")).rejects.toThrow(ProviderRateLimitError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

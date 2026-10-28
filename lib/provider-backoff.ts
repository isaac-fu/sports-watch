export class ProviderRateLimitError extends Error {
  constructor(public retryAt: number) { super("Sports provider rate limit reached. Retry after cooldown."); }
}

export class ProviderBackoff {
  private failures = 0;
  private retryAt = 0;
  constructor(private now = Date.now) {}
  check() {
    if (this.now() < this.retryAt) throw new ProviderRateLimitError(this.retryAt);
  }
  limited(retryAfter: string | null) {
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const requested = Number.isFinite(seconds) ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - this.now() : 0;
    const delay = Math.max(Math.min(60_000 * 2 ** this.failures++, 15 * 60_000), Number.isFinite(requested) ? requested : 0);
    this.retryAt = this.now() + delay;
    return new ProviderRateLimitError(this.retryAt);
  }
  success() {
    // An older in-flight success must not cancel a newer request's cooldown.
    if (this.now() >= this.retryAt) { this.failures = 0; this.retryAt = 0; }
  }
}

// Shared across provider instances in this process, including different date ranges.
const gates = new Map<string, ProviderBackoff>();
export async function fetchSportsProvider(url: string, apiKey: string) {
  const key = `${new URL(url).origin}:${apiKey}`;
  let gate = gates.get(key);
  if (!gate) { gate = new ProviderBackoff(); gates.set(key, gate); }
  gate.check();
  const response = await fetch(url, { headers: { Authorization: apiKey }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (response.status === 429) throw gate.limited(response.headers.get("Retry-After"));
  if (response.ok) gate.success();
  return response;
}

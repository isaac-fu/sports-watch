import { pacificDateKey } from "./game-time";

type Entry<T> = { value: T; expiresAt: number; storedAt: number };

/** Bounded process/tab-local cache. Failed loads never replace a successful entry. */
export class ScheduleCache<T> {
  private entries = new Map<string, Entry<T>>();
  private pending = new Map<string, Promise<Entry<T>>>();

  constructor(private limit = 36, private now = Date.now) {}

  peek(key: string) {
    const entry = this.entries.get(key);
    return entry && this.now() - entry.storedAt < 24 * 60 * 60_000 ? entry : undefined;
  }

  get(key: string, load: () => Promise<T>, ttl: (value: T) => number): Promise<Entry<T>> {
    const cached = this.peek(key);
    if (cached && cached.expiresAt > this.now()) return Promise.resolve(cached);
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = Promise.resolve().then(load).then((value) => {
      const storedAt = this.now();
      const entry = { value, storedAt, expiresAt: storedAt + ttl(value) };
      this.entries.delete(key);
      this.entries.set(key, entry);
      while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
      return entry;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
}

export function scheduleTtlMs(filters: { from?: string; to?: string }, games: { status: string }[], now = Date.now()) {
  const today = pacificDateKey(new Date(now).toISOString(), "");
  if (games.some((game) => game.status === "live")) return 30_000;
  if ((!filters.from || filters.from <= today) && (!filters.to || filters.to >= today)) return 30_000;
  // Empty historical responses may be temporary provider gaps; retry them sooner.
  if (filters.to && filters.to < today && games.length && games.every((game) => game.status === "final")) return 60 * 60_000;
  return 5 * 60_000;
}

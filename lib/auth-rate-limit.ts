import { createHash } from "node:crypto";

type RateLimitEntry = { count: number; resetAt: number };

declare global { var __sportsWatchAuthRateLimits: Map<string, RateLimitEntry> | undefined; }

const entries = globalThis.__sportsWatchAuthRateLimits ?? (globalThis.__sportsWatchAuthRateLimits = new Map());

type AuthAction = "login" | "register" | "forgot-password" | "reset-password";

const limits: Record<AuthAction, { windowMs: number; perIp: number; perIdentity: number }> = {
  login: { windowMs: 15 * 60_000, perIp: 50, perIdentity: 10 },
  register: { windowMs: 60 * 60_000, perIp: 10, perIdentity: 3 },
  "forgot-password": { windowMs: 60 * 60_000, perIp: 10, perIdentity: 3 },
  "reset-password": { windowMs: 15 * 60_000, perIp: 30, perIdentity: 10 },
};

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function identityHash(identity: string) {
  return createHash("sha256").update(identity.trim().toLowerCase()).digest("hex").slice(0, 24);
}

function consume(key: string, maximum: number, windowMs: number, now: number) {
  const current = entries.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  entries.set(key, entry);
  return entry.count > maximum ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;
}

export function authRateLimitResponse(request: Request, action: AuthAction, identity: string): Response | null {
  const now = Date.now();
  const policy = limits[action];
  const ip = clientIp(request);
  const ipRetryAfter = consume(`${action}:ip:${ip}`, policy.perIp, policy.windowMs, now);
  const identityRetryAfter = consume(`${action}:identity:${identityHash(identity)}`, policy.perIdentity, policy.windowMs, now);
  const retryAfter = Math.max(ipRetryAfter, identityRetryAfter);

  if (entries.size > 10_000) {
    for (const [key, entry] of Array.from(entries.entries())) if (entry.resetAt <= now) entries.delete(key);
  }
  if (!retryAfter) return null;
  return Response.json({ error: "Too many attempts. Please try again later." }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
}

export function resetAuthIdentityRateLimit(request: Request, action: AuthAction, identity: string) {
  void request;
  entries.delete(`${action}:identity:${identityHash(identity)}`);
}

export function clearAuthRateLimitsForTests() {
  entries.clear();
}

import { beforeEach, describe, expect, it } from "vitest";
import { authRateLimitResponse, clearAuthRateLimitsForTests, resetAuthIdentityRateLimit } from "@/lib/auth-rate-limit";

const request = () => new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": "203.0.113.8" } });

describe("authentication rate limiting", () => {
  beforeEach(() => clearAuthRateLimitsForTests());

  it("limits repeated login attempts for the same address and identity", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) expect(authRateLimitResponse(request(), "login", "User@Example.com")).toBeNull();
    const response = authRateLimitResponse(request(), "login", "user@example.com");
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("clears the identity limit after a successful login", () => {
    for (let attempt = 0; attempt < 9; attempt += 1) authRateLimitResponse(request(), "login", "user@example.com");
    resetAuthIdentityRateLimit(request(), "login", "user@example.com");
    expect(authRateLimitResponse(request(), "login", "user@example.com")).toBeNull();
  });
});

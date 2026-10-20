import { afterEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { GET as verifyEmail } from "@/app/api/auth/verify-email/route";
import { clearAuthRateLimitsForTests } from "@/lib/auth-rate-limit";
import { resolveSession } from "@/lib/auth-repository";

const originalEmailProvider = process.env.EMAIL_DATA_PROVIDER;
const originalAppBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
  clearAuthRateLimitsForTests();
  if (originalEmailProvider === undefined) delete process.env.EMAIL_DATA_PROVIDER;
  else process.env.EMAIL_DATA_PROVIDER = originalEmailProvider;
  if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalAppBaseUrl;
});

describe("authentication routes", () => {
  it("creates an account and supports verification-link recovery through sign in", async () => {
    process.env.EMAIL_DATA_PROVIDER = "console";
    process.env.APP_BASE_URL = "http://localhost:3000";
    const email = `route-auth-${Date.now()}-${Math.random()}@example.com`;
    const password = "route-password-123";

    const registration = await register(new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify({ displayName: "Route Test", email, password, timezone: "America/Los_Angeles" }),
    }));
    expect(registration.status).toBe(201);
    const registrationPayload = await registration.json();
    expect(registrationPayload.meta).toMatchObject({ verificationRequired: true, emailProvider: "console" });
    expect(registrationPayload.meta.previewUrl).toContain("/api/auth/verify-email?token=");

    const unverifiedLogin = await login(new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify({ email, password }),
    }));
    expect(unverifiedLogin.status).toBe(403);
    const unverifiedPayload = await unverifiedLogin.json();
    expect(unverifiedPayload.meta.previewUrl).toContain("/api/auth/verify-email?token=");

    const verification = await verifyEmail(new Request(unverifiedPayload.meta.previewUrl));
    expect(verification.status).toBeGreaterThanOrEqual(300);
    expect(verification.status).toBeLessThan(400);
    expect(verification.headers.get("Location")).toBe("http://localhost:3000/?verification=account");
    expect(verification.headers.get("Set-Cookie")).toContain("courtside_session=");

    const verifiedLogin = await login(new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify({ email, password }),
    }));
    expect(verifiedLogin.status).toBe(200);
  });

  it("resets a password with a single-use link and revokes existing sessions", async () => {
    process.env.EMAIL_DATA_PROVIDER = "console";
    process.env.APP_BASE_URL = "http://localhost:3000";
    const email = `route-reset-${Date.now()}-${Math.random()}@example.com`;
    const oldPassword = "old-password-123";
    const newPassword = "new-password-456";
    const headers = { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.19" };

    const registration = await register(new Request("http://localhost:3000/api/auth/register", {
      method: "POST", headers, body: JSON.stringify({ displayName: "Reset Test", email, password: oldPassword, timezone: "UTC" }),
    }));
    const registrationPayload = await registration.json();
    const verification = await verifyEmail(new Request(registrationPayload.meta.previewUrl));
    const sessionCookie = verification.headers.get("Set-Cookie") ?? "";
    const sessionToken = decodeURIComponent(sessionCookie.match(/courtside_session=([^;]+)/)?.[1] ?? "");
    expect(await resolveSession(sessionToken)).not.toBeNull();

    const unknownRequest = await forgotPassword(new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST", headers: { ...headers, "x-forwarded-for": "198.51.100.20" }, body: JSON.stringify({ email: `missing-${email}` }),
    }));
    const unknownPayload = await unknownRequest.json();
    expect(unknownRequest.status).toBe(200);
    expect(unknownPayload.meta.message).toContain("If an account exists");
    expect(unknownPayload.meta.previewUrl).toBeUndefined();

    const resetRequest = await forgotPassword(new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST", headers, body: JSON.stringify({ email }),
    }));
    const resetRequestPayload = await resetRequest.json();
    expect(resetRequest.status).toBe(200);
    expect(resetRequestPayload.meta.message).toBe(unknownPayload.meta.message);
    const resetUrl = new URL(resetRequestPayload.meta.previewUrl);
    const token = resetUrl.searchParams.get("reset-password");
    expect(token).toBeTruthy();

    const wrongEndpoint = await verifyEmail(new Request(`http://localhost:3000/api/auth/verify-email?token=${encodeURIComponent(token ?? "")}`));
    expect(wrongEndpoint.headers.get("Location")).toBe("http://localhost:3000/?verification=invalid");

    const mismatch = await resetPassword(new Request("http://localhost:3000/api/auth/reset-password", {
      method: "POST", headers, body: JSON.stringify({ token, newPassword, confirmPassword: "different-password" }),
    }));
    expect(mismatch.status).toBe(400);

    const changed = await resetPassword(new Request("http://localhost:3000/api/auth/reset-password", {
      method: "POST", headers, body: JSON.stringify({ token, newPassword, confirmPassword: newPassword }),
    }));
    expect(changed.status).toBe(200);
    expect(changed.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await resolveSession(sessionToken)).toBeNull();

    const oldLogin = await login(new Request("http://localhost:3000/api/auth/login", {
      method: "POST", headers, body: JSON.stringify({ email, password: oldPassword }),
    }));
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(new Request("http://localhost:3000/api/auth/login", {
      method: "POST", headers, body: JSON.stringify({ email, password: newPassword }),
    }));
    expect(newLogin.status).toBe(200);

    const reused = await resetPassword(new Request("http://localhost:3000/api/auth/reset-password", {
      method: "POST", headers, body: JSON.stringify({ token, newPassword: "third-password-789", confirmPassword: "third-password-789" }),
    }));
    expect(reused.status).toBe(400);
  });
});

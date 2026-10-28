import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailVerification, createPasswordReset, registerAccount, resetPasswordWithToken, updateAccountSettings, verifyEmailToken } from "@/lib/auth-repository";
import { getAccountContext, getSessionToken } from "@/lib/auth-session";
import { sendVerificationEmail } from "@/lib/email-service";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const account = () => registerAccount({ displayName: "Security Test", email: `security-${crypto.randomUUID()}@example.com`, password: "old-password-123", timezone: "UTC" });
const email = { to: "test@example.com", displayName: "<Test>", verificationUrl: "https://example.com/verify?token=test", purpose: "signup" as const };

describe("auth security regressions", () => {
  it("treats malformed session cookies as unauthenticated", async () => {
    const request = new Request("http://localhost/api/account", { headers: { cookie: "courtside_session=%E0%A4%A" } });
    expect(getSessionToken(request)).toBeNull();
    expect(await getAccountContext(request)).toMatchObject({ authenticated: false });
  });

  it.each(["console", ""])("never exposes console recovery links in production (%s)", async (provider) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_DATA_PROVIDER", provider);
    await expect(sendVerificationEmail(email)).rejects.toThrow("disabled in production");
  });

  it("keeps development previews available", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_DATA_PROVIDER", "console");
    expect(await sendVerificationEmail(email)).toEqual({ provider: "console", previewUrl: email.verificationUrl });
  });

  it("sends escaped email through a mocked provider without exposing a preview", async () => {
    vi.stubEnv("EMAIL_DATA_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test-only-placeholder");
    vi.stubEnv("EMAIL_FROM", "test@example.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendVerificationEmail(email)).toEqual({ provider: "resend" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).html).toContain("&lt;Test&gt;");
    fetchMock.mockResolvedValue(new Response("private provider detail", { status: 403 }));
    await expect(sendVerificationEmail(email)).rejects.toThrow("Email delivery failed with 403.");
  });

  it("invalidates all outstanding recovery links after a password change", async () => {
    const owner = await account();
    const signup = await createEmailVerification(owner.id, "signup");
    const reset = await createPasswordReset(owner.email);
    await updateAccountSettings(owner.id, { currentPassword: "old-password-123", newPassword: "new-password-456" });
    await expect(verifyEmailToken(signup.token)).rejects.toThrow("invalid or expired");
    await expect(resetPasswordWithToken(reset!.token, "attacker-password")).rejects.toThrow("invalid or expired");
    const current = await createEmailVerification(owner.id, "password-change");
    expect((await verifyEmailToken(current.token)).account.emailVerified).toBe(true);
  });

  it("invalidates outstanding sign-in verification links after a password reset", async () => {
    const owner = await account();
    const signup = await createEmailVerification(owner.id, "signup");
    const reset = await createPasswordReset(owner.email);
    await resetPasswordWithToken(reset!.token, "new-password-456");
    await expect(verifyEmailToken(signup.token)).rejects.toThrow("invalid or expired");
  });
});

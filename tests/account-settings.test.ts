import { describe, expect, it } from "vitest";
import { authenticateAccount, createEmailVerification, EmailNotVerifiedError, InvalidCurrentPasswordError, registerAccount, updateAccountSettings, verifyEmailToken } from "@/lib/auth-repository";

async function verify(accountId: string, purpose: "signup" | "password-change" = "signup") {
  const verification = await createEmailVerification(accountId, purpose);
  return verifyEmailToken(verification.token);
}

describe("account settings", () => {
  it("updates a display name and password after verifying the current password", async () => {
    const email = `settings-${Date.now()}-${Math.random()}@example.com`;
    const account = await registerAccount({ displayName: "Old Name", email, password: "old-password-123", timezone: "America/Los_Angeles" });
    await verify(account.id);
    const updated = await updateAccountSettings(account.id, { displayName: "New Name", currentPassword: "old-password-123", newPassword: "new-password-456" });
    expect(updated.displayName).toBe("New Name");
    expect(updated.emailVerified).toBe(false);
    expect(await authenticateAccount(email, "old-password-123")).toBeNull();
    await expect(authenticateAccount(email, "new-password-456")).rejects.toBeInstanceOf(EmailNotVerifiedError);
    await verify(account.id, "password-change");
    expect((await authenticateAccount(email, "new-password-456"))?.displayName).toBe("New Name");
  });

  it("rejects an incorrect current password", async () => {
    const email = `settings-invalid-${Date.now()}-${Math.random()}@example.com`;
    const account = await registerAccount({ displayName: "Test User", email, password: "old-password-123", timezone: "America/Los_Angeles" });
    await verify(account.id);
    await expect(updateAccountSettings(account.id, { currentPassword: "wrong-password", newPassword: "new-password-456" })).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
  });

  it("updates the timezone used for regional game times", async () => {
    const email = `settings-timezone-${Date.now()}-${Math.random()}@example.com`;
    const account = await registerAccount({ displayName: "Time Zone", email, password: "old-password-123", timezone: "America/Los_Angeles" });
    await verify(account.id);
    const updated = await updateAccountSettings(account.id, { timezone: "America/New_York" });
    expect(updated.timezone).toBe("America/New_York");
  });

  it("requires a single-use email verification before a new account can sign in", async () => {
    const email = `settings-verification-${Date.now()}-${Math.random()}@example.com`;
    const account = await registerAccount({ displayName: "Verify Me", email, password: "safe-password-123", timezone: "America/Los_Angeles" });
    await expect(authenticateAccount(email, "safe-password-123")).rejects.toBeInstanceOf(EmailNotVerifiedError);
    const verification = await createEmailVerification(account.id, "signup");
    const verified = await verifyEmailToken(verification.token);
    expect(verified.account.emailVerified).toBe(true);
    expect(await authenticateAccount(email, "safe-password-123")).toMatchObject({ email, emailVerified: true });
    await expect(verifyEmailToken(verification.token)).rejects.toThrow("invalid or expired");
  });
});

import { describe, expect, it } from "vitest";
import { authenticateAccount, InvalidCurrentPasswordError, registerAccount, updateAccountSettings } from "@/lib/auth-repository";

describe("account settings", () => {
  it("updates a display name and password after verifying the current password", async () => {
    const email = `settings-${Date.now()}-${Math.random()}@example.com`;
    const account = await registerAccount({ displayName: "Old Name", email, password: "old-password-123", timezone: "America/Los_Angeles" });
    const updated = await updateAccountSettings(account.id, { displayName: "New Name", currentPassword: "old-password-123", newPassword: "new-password-456" });
    expect(updated.displayName).toBe("New Name");
    expect(await authenticateAccount(email, "old-password-123")).toBeNull();
    expect((await authenticateAccount(email, "new-password-456"))?.displayName).toBe("New Name");
  });

  it("rejects an incorrect current password", async () => {
    const email = `settings-invalid-${Date.now()}-${Math.random()}@example.com`;
    const account = await registerAccount({ displayName: "Test User", email, password: "old-password-123", timezone: "America/Los_Angeles" });
    await expect(updateAccountSettings(account.id, { currentPassword: "wrong-password", newPassword: "new-password-456" })).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
  });
});

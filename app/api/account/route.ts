import { clearedSessionCookie, getAccountContext } from "@/lib/auth-session";
import { createEmailVerification, getOnboardingCompleted, InvalidCurrentPasswordError, updateAccountSettings } from "@/lib/auth-repository";
import { sendVerificationEmail } from "@/lib/email-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  const onboardingCompleted = context.authenticated ? await getOnboardingCompleted(context.accountId) : true;
  return Response.json(
    { data: context.account, meta: { authenticated: context.authenticated, onboardingCompleted } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const context = await getAccountContext(request);
  if (!context.authenticated) return Response.json({ error: "Sign in to update account settings." }, { status: 401 });
  const body = await request.json().catch(() => null) as { displayName?: unknown; timezone?: unknown; currentPassword?: unknown; newPassword?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid account settings payload." }, { status: 400 });

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : undefined;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : undefined;
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;
  if (displayName !== undefined && (displayName.length < 2 || displayName.length > 50)) return Response.json({ error: "Name must be between 2 and 50 characters." }, { status: 400 });
  if (timezone !== undefined) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); } catch { return Response.json({ error: "Choose a valid timezone." }, { status: 400 }); }
  }
  if (newPassword !== undefined && (newPassword.length < 8 || newPassword.length > 128)) return Response.json({ error: "New password must be between 8 and 128 characters." }, { status: 400 });
  if (newPassword !== undefined && !currentPassword) return Response.json({ error: "Enter your current password." }, { status: 400 });
  if (displayName === undefined && timezone === undefined && newPassword === undefined) return Response.json({ error: "No account changes were provided." }, { status: 400 });

  try {
    const account = await updateAccountSettings(context.accountId, { displayName, timezone, currentPassword, newPassword });
    if (newPassword) {
      const verification = await createEmailVerification(account.id, "password-change");
      const baseUrl = process.env.APP_BASE_URL?.trim() || new URL(request.url).origin;
      const verificationUrl = new URL(`/api/auth/verify-email?token=${encodeURIComponent(verification.token)}`, baseUrl).toString();
      const delivery = await sendVerificationEmail({ to: account.email, displayName: account.displayName, verificationUrl, purpose: "password-change" });
      return Response.json({ data: account, meta: { verificationRequired: true, signedOut: true, emailProvider: delivery.provider, previewUrl: delivery.previewUrl } }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearedSessionCookie() } });
    }
    return Response.json({ data: account, meta: { verificationRequired: false } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidCurrentPasswordError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Could not update account settings." }, { status: 500 });
  }
}

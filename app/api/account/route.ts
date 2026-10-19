import { getAccountContext } from "@/lib/auth-session";
import { getOnboardingCompleted, InvalidCurrentPasswordError, updateAccountSettings } from "@/lib/auth-repository";

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
  const body = await request.json().catch(() => null) as { displayName?: unknown; currentPassword?: unknown; newPassword?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid account settings payload." }, { status: 400 });

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : undefined;
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;
  if (displayName !== undefined && (displayName.length < 2 || displayName.length > 50)) return Response.json({ error: "Name must be between 2 and 50 characters." }, { status: 400 });
  if (newPassword !== undefined && (newPassword.length < 8 || newPassword.length > 128)) return Response.json({ error: "New password must be between 8 and 128 characters." }, { status: 400 });
  if (newPassword !== undefined && !currentPassword) return Response.json({ error: "Enter your current password." }, { status: 400 });
  if (displayName === undefined && newPassword === undefined) return Response.json({ error: "No account changes were provided." }, { status: 400 });

  try {
    const account = await updateAccountSettings(context.accountId, { displayName, currentPassword, newPassword });
    return Response.json({ data: account }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidCurrentPasswordError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Could not update account settings." }, { status: 500 });
  }
}

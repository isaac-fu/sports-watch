import { resetPasswordWithToken } from "@/lib/auth-repository";
import { authRateLimitResponse, resetAuthIdentityRateLimit } from "@/lib/auth-rate-limit";
import { clearedSessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; newPassword?: unknown; confirmPassword?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  if (!token || token.length > 200) return Response.json({ error: "This password reset link is invalid or expired." }, { status: 400 });
  if (newPassword.length < 8 || newPassword.length > 128) return Response.json({ error: "Password must be between 8 and 128 characters." }, { status: 400 });
  if (newPassword !== confirmPassword) return Response.json({ error: "The new passwords do not match." }, { status: 400 });
  const limited = authRateLimitResponse(request, "reset-password", token);
  if (limited) return limited;

  try {
    await resetPasswordWithToken(token, newPassword);
    resetAuthIdentityRateLimit(request, "reset-password", token);
    return Response.json({ data: { passwordReset: true } }, {
      headers: { "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("invalid or expired") || error.message === "Account not found.")) {
      return Response.json({ error: "This password reset link is invalid or expired." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Password reset failed.", error instanceof Error ? error.message : error);
    return Response.json({ error: "Password reset failed. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

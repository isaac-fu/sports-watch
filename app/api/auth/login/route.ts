import { authenticateAccount, createEmailVerification, createSession, EmailNotVerifiedError } from "@/lib/auth-repository";
import { sessionCookie } from "@/lib/auth-session";
import { sendVerificationEmail } from "@/lib/email-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return Response.json({ error: "Email and password are required." }, { status: 400 });
  if (email.length > 254 || password.length > 128) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });

  try {
    const account = await authenticateAccount(email, password);
    if (!account) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    const session = await createSession(account.id);
    return Response.json({ data: account, meta: { authenticated: true } }, {
      headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt), "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof EmailNotVerifiedError) {
      const verification = await createEmailVerification(error.account.id, "signup");
      const baseUrl = process.env.APP_BASE_URL?.trim() || new URL(request.url).origin;
      const verificationUrl = new URL(`/api/auth/verify-email?token=${encodeURIComponent(verification.token)}`, baseUrl).toString();
      const delivery = await sendVerificationEmail({ to: error.account.email, displayName: error.account.displayName, verificationUrl, purpose: "signup" }).catch(() => null);
      return Response.json({ error: error.message, meta: { verificationRequired: true, previewUrl: delivery?.previewUrl } }, { status: 403 });
    }
    return Response.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}

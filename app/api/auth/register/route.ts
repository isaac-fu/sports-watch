import { createEmailVerification, DuplicateEmailError, registerAccount } from "@/lib/auth-repository";
import { sendVerificationEmail } from "@/lib/email-service";
import { authRateLimitResponse } from "@/lib/auth-rate-limit";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { displayName?: unknown; email?: unknown; password?: unknown; timezone?: unknown } | null;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  let timezone = typeof body?.timezone === "string" ? body.timezone : "UTC";

  if (displayName.length < 2 || displayName.length > 50) return Response.json({ error: "Name must be between 2 and 50 characters." }, { status: 400 });
  if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8 || password.length > 128) return Response.json({ error: "Password must be between 8 and 128 characters." }, { status: 400 });
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); } catch { timezone = "UTC"; }
  const limited = authRateLimitResponse(request, "register", email);
  if (limited) return limited;

  try {
    const account = await registerAccount({ displayName, email, password, timezone });
    const verification = await createEmailVerification(account.id, "signup");
    const baseUrl = process.env.APP_BASE_URL?.trim() || new URL(request.url).origin;
    const verificationUrl = new URL(`/api/auth/verify-email?token=${encodeURIComponent(verification.token)}`, baseUrl).toString();
    let delivery: Awaited<ReturnType<typeof sendVerificationEmail>>;
    try {
      delivery = await sendVerificationEmail({ to: account.email, displayName: account.displayName, verificationUrl, purpose: "signup" });
    } catch (deliveryError) {
      console.error("Registration email delivery failed.", deliveryError instanceof Error ? deliveryError.message : deliveryError);
      return Response.json({
        error: "Account created, but the verification message could not be delivered.",
        meta: { authenticated: false, verificationRequired: true, accountCreated: true },
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ data: account, meta: { authenticated: false, verificationRequired: true, emailProvider: delivery.provider, previewUrl: delivery.previewUrl } }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DuplicateEmailError) return Response.json({ error: error.message }, { status: 409 });
    console.error("Account registration failed.", error instanceof Error ? error.message : error);
    return Response.json({ error: "Account creation failed. Please try again." }, { status: 500 });
  }
}

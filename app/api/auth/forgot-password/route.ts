import { createPasswordReset } from "@/lib/auth-repository";
import { authRateLimitResponse } from "@/lib/auth-rate-limit";
import { sendVerificationEmail } from "@/lib/email-service";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const acceptedMessage = "If an account exists for that email, a password reset link has been sent.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const limited = authRateLimitResponse(request, "forgot-password", email);
  if (limited) return limited;

  try {
    const reset = await createPasswordReset(email);
    let previewUrl: string | undefined;
    if (reset) {
      const baseUrl = process.env.APP_BASE_URL?.trim() || new URL(request.url).origin;
      const resetUrl = new URL(`/?reset-password=${encodeURIComponent(reset.token)}`, baseUrl).toString();
      try {
        const delivery = await sendVerificationEmail({
          to: reset.account.email,
          displayName: reset.account.displayName,
          verificationUrl: resetUrl,
          purpose: "password-reset",
        });
        previewUrl = delivery.previewUrl;
      } catch (deliveryError) {
        console.error("Password reset email delivery failed.", deliveryError instanceof Error ? deliveryError.message : deliveryError);
      }
    }
    return Response.json({ data: { accepted: true }, meta: { message: acceptedMessage, previewUrl } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Password reset request failed.", error instanceof Error ? error.message : error);
    return Response.json({ error: "Password reset is temporarily unavailable. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

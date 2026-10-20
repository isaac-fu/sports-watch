import { createSession, verifyEmailToken } from "@/lib/auth-repository";
import { sessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const redirect = new URL("/", process.env.APP_BASE_URL?.trim() || new URL(request.url).origin);
  if (!token || token.length > 200) {
    redirect.searchParams.set("verification", "invalid");
    return Response.redirect(redirect);
  }
  try {
    const result = await verifyEmailToken(token);
    const session = await createSession(result.account.id);
    redirect.searchParams.set("verification", result.purpose === "signup" ? "account" : "password");
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirect.toString(),
        "Set-Cookie": sessionCookie(session.token, session.expiresAt),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Email verification failed.", error instanceof Error ? error.message : error);
    redirect.searchParams.set("verification", "invalid");
    return Response.redirect(redirect);
  }
}

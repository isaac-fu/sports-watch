import { createSession, verifyEmailToken } from "@/lib/auth-repository";
import { sessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const redirect = new URL("/", request.url);
  if (!token || token.length > 200) {
    redirect.searchParams.set("verification", "invalid");
    return Response.redirect(redirect);
  }
  try {
    const result = await verifyEmailToken(token);
    const session = await createSession(result.account.id);
    redirect.searchParams.set("verification", result.purpose === "signup" ? "account" : "password");
    const response = Response.redirect(redirect);
    response.headers.set("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    redirect.searchParams.set("verification", "invalid");
    return Response.redirect(redirect);
  }
}

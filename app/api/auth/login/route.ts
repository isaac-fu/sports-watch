import { authenticateAccount, createSession } from "@/lib/auth-repository";
import { sessionCookie } from "@/lib/auth-session";

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
  } catch {
    return Response.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}

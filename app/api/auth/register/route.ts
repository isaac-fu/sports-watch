import { createSession, DuplicateEmailError, registerAccount } from "@/lib/auth-repository";
import { sessionCookie } from "@/lib/auth-session";

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

  try {
    const account = await registerAccount({ displayName, email, password, timezone });
    const session = await createSession(account.id);
    return Response.json({ data: account, meta: { authenticated: true } }, {
      status: 201,
      headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt), "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DuplicateEmailError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Account creation failed. Please try again." }, { status: 500 });
  }
}

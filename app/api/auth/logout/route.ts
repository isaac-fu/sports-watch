import { deleteSession } from "@/lib/auth-repository";
import { clearedSessionCookie, getSessionToken } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = getSessionToken(request);
  if (token) await deleteSession(token);
  return Response.json({ data: { authenticated: false } }, {
    headers: { "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" },
  });
}

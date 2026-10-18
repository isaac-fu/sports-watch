import type { Account } from "./models";
import { resolveSession } from "./auth-repository";
import { appStore, demoAccountId } from "./store";

export const sessionCookieName = "courtside_session";

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const pair of cookies.split(";")) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export type AccountContext = { account: Account; accountId: string; authenticated: boolean };

export async function getAccountContext(request: Request): Promise<AccountContext> {
  const token = cookieValue(request, sessionCookieName);
  const account = token ? await resolveSession(token) : null;
  return account
    ? { account, accountId: account.id, authenticated: true }
    : { account: appStore.account, accountId: demoAccountId, authenticated: false };
}

export function getSessionToken(request: Request) {
  return cookieValue(request, sessionCookieName);
}

export function sessionCookie(token: string, expiresAt: Date) {
  const secure = process.env.AUTH_COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearedSessionCookie() {
  const secure = process.env.AUTH_COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

import { playerIds, teamIds } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-repository";
import type { AlertPreferences, Preferences } from "@/lib/models";
import { getCurrentPreferences, updateCurrentPreferences } from "@/lib/preferences-repository";
import { getAccountContext } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  return Response.json({ data: await getCurrentPreferences(context.accountId), meta: { authenticated: context.authenticated } });
}

export async function PATCH(request: Request) {
  const context = await getAccountContext(request);
  if (!context.authenticated) return Response.json({ error: "Sign in to save preferences." }, { status: 401 });
  const body = await request.json() as Partial<Preferences>;
  await loadCatalog();
  const validTeamIds = teamIds();
  const validPlayerIds = playerIds();

  if (body.followedTeamIds && (!Array.isArray(body.followedTeamIds) || body.followedTeamIds.some((id) => !validTeamIds.has(id)))) return Response.json({ error: "One or more followedTeamIds are invalid." }, { status: 400 });
  if (body.followedPlayerIds && (!Array.isArray(body.followedPlayerIds) || body.followedPlayerIds.some((id) => !validPlayerIds.has(id)))) return Response.json({ error: "One or more followedPlayerIds are invalid." }, { status: 400 });

  const alerts = body.alerts as Partial<AlertPreferences> | undefined;
  const alertKeys = new Set(["gameStarting", "closeGame", "finalScore", "standoutPerformance", "injuryUpdate", "leadChange", "milestone"]);
  if (alerts && Object.entries(alerts).some(([key, value]) => !alertKeys.has(key) || typeof value !== "boolean")) return Response.json({ error: "Alert preferences must use known boolean fields." }, { status: 400 });

  const current = await getCurrentPreferences(context.accountId);
  const next = { ...current, ...body, alerts: { ...current.alerts, ...alerts } };
  return Response.json({ data: await updateCurrentPreferences(context.accountId, next) });
}

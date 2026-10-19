import { completeAccountOnboarding } from "@/lib/auth-repository";
import { getAccountContext } from "@/lib/auth-session";
import { playerIds as canonicalPlayerIds, teamIds as canonicalTeamIds } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-repository";
import type { AlertPreferences, Preferences } from "@/lib/models";
import { cachePreferences } from "@/lib/preferences-repository";

export const dynamic = "force-dynamic";

const alertKeys: Array<keyof AlertPreferences> = ["gameStarting", "closeGame", "finalScore", "standoutPerformance", "injuryUpdate", "leadChange", "milestone"];

export async function POST(request: Request) {
  const context = await getAccountContext(request);
  if (!context.authenticated) return Response.json({ error: "Sign in to complete onboarding." }, { status: 401 });

  const body = await request.json().catch(() => null) as Partial<Preferences> | null;
  const teamIds = body?.followedTeamIds;
  const playerIds = body?.followedPlayerIds;
  const alerts = body?.alerts;
  await loadCatalog();
  const validTeamIds = canonicalTeamIds();
  const validPlayerIds = canonicalPlayerIds();

  if (!Array.isArray(teamIds) || teamIds.some((id) => typeof id !== "string" || !validTeamIds.has(id))) return Response.json({ error: "One or more selected teams are invalid." }, { status: 400 });
  if (!Array.isArray(playerIds) || playerIds.some((id) => typeof id !== "string" || !validPlayerIds.has(id))) return Response.json({ error: "One or more selected players are invalid." }, { status: 400 });
  if (!alerts || alertKeys.some((key) => typeof alerts[key] !== "boolean")) return Response.json({ error: "All alert preferences are required." }, { status: 400 });

  const preferences: Preferences = {
    followedTeamIds: Array.from(new Set(teamIds)),
    followedPlayerIds: Array.from(new Set(playerIds)),
    alerts: Object.fromEntries(alertKeys.map((key) => [key, alerts[key]])) as AlertPreferences,
  };
  await completeAccountOnboarding(context.accountId, preferences);
  cachePreferences(context.accountId, preferences);
  return Response.json({ data: preferences, meta: { onboardingCompleted: true } });
}

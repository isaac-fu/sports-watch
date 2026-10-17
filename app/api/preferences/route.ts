import { mockPlayers, mockTeams } from "@/lib/mock-repository";
import type { AlertPreferences, Preferences } from "@/lib/models";
import { getCurrentPreferences, updateCurrentPreferences } from "@/lib/preferences-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ data: await getCurrentPreferences() });
}

export async function PATCH(request: Request) {
  const body = await request.json() as Partial<Preferences>;
  const validTeamIds = new Set(mockTeams.map((team) => team.id));
  const validPlayerIds = new Set(mockPlayers.map((player) => player.id));

  if (body.followedTeamIds && (!Array.isArray(body.followedTeamIds) || body.followedTeamIds.some((id) => !validTeamIds.has(id)))) return Response.json({ error: "One or more followedTeamIds are invalid." }, { status: 400 });
  if (body.followedPlayerIds && (!Array.isArray(body.followedPlayerIds) || body.followedPlayerIds.some((id) => !validPlayerIds.has(id)))) return Response.json({ error: "One or more followedPlayerIds are invalid." }, { status: 400 });

  const alerts = body.alerts as Partial<AlertPreferences> | undefined;
  if (alerts && Object.values(alerts).some((value) => typeof value !== "boolean")) return Response.json({ error: "Alert preferences must be boolean values." }, { status: 400 });

  const current = await getCurrentPreferences();
  const next = { ...current, ...body, alerts: { ...current.alerts, ...alerts } };
  return Response.json({ data: await updateCurrentPreferences(next) });
}

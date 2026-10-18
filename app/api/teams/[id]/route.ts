import { getTeamProfile } from "@/lib/team-profile-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const profile = await getTeamProfile(params.id);
  if (!profile) return Response.json({ error: "Team not found." }, { status: 404 });
  return Response.json({ data: profile, meta: { source: profile.source, updatedAt: profile.updatedAt } });
}

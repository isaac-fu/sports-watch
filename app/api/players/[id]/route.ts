import { getPlayerProfile } from "@/lib/player-profile-service";
import { publicCache } from "@/lib/http-cache";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const profile = await getPlayerProfile(params.id);
  if (!profile) return Response.json({ error: "Player not found." }, { status: 404 });
  return Response.json({ data: profile, meta: { source: profile.source, updatedAt: profile.updatedAt } }, { headers: publicCache(60, 300) });
}

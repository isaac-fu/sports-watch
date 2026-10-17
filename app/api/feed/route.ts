import { getFeed } from "@/lib/mock-repository";
import { getCurrentPreferences } from "@/lib/preferences-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;
  const { followedTeamIds, followedPlayerIds } = await getCurrentPreferences();
  const data = getFeed(followedTeamIds, followedPlayerIds).slice(0, limit);
  return Response.json({ data, meta: { count: data.length, source: "personalized-mock-repository" } });
}

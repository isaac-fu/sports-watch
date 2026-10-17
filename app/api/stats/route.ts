import { mockPlayerStats, mockTeamStats } from "@/lib/mock-repository";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const teamId = searchParams.get("teamId");
  const playerId = searchParams.get("playerId");
  const players = playerId ? mockPlayerStats.filter((stat) => stat.playerId === playerId) : teamId ? mockPlayerStats.filter((stat) => stat.teamId === teamId) : mockPlayerStats;
  const teams = teamId ? mockTeamStats.filter((stat) => stat.teamId === teamId) : mockTeamStats;
  return Response.json({ data: { season: "2025-26", players, teams }, meta: { source: "mock-repository" } });
}

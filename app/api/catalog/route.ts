import { mockPlayers, mockTeams } from "@/lib/mock-repository";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    data: { teams: mockTeams, players: mockPlayers },
    meta: { teamCount: mockTeams.length, playerCount: mockPlayers.length, source: "mock-repository" },
  });
}

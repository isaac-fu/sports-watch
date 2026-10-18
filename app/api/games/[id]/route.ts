import { getGameCenter } from "@/lib/game-center-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const gameCenter = await getGameCenter(params.id);
    if (!gameCenter) return Response.json({ error: "Game not found." }, { status: 404 });
    return Response.json({ data: gameCenter, meta: { source: gameCenter.source, eventCount: gameCenter.events.length } });
  } catch {
    return Response.json({ error: "The game center is temporarily unavailable." }, { status: 502 });
  }
}

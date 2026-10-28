import { loadCatalog } from "@/lib/catalog-repository";
import { resolveGame } from "@/lib/game-provider";
import { getCachedBoxScore } from "@/lib/box-score-service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await loadCatalog();
    const game = await resolveGame(params.id);
    if (!game) return Response.json({ error: "Game not found." }, { status: 404 });
    return Response.json({ data: await getCachedBoxScore(game) });
  } catch {
    return Response.json({ error: "Box scores are temporarily unavailable." }, { status: 502 });
  }
}

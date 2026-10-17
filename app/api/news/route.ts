import { mockNews } from "@/lib/mock-repository";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const teamId = searchParams.get("teamId");
  const playerId = searchParams.get("playerId");
  const query = searchParams.get("q")?.toLowerCase();
  const articles = mockNews.filter((article) => (!teamId || article.teamIds.includes(teamId)) && (!playerId || article.playerIds.includes(playerId)) && (!query || `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase().includes(query)));
  return Response.json({ data: articles, meta: { count: articles.length, source: "mock-repository" } });
}

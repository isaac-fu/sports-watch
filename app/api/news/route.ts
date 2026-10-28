import { loadNewsArticles } from "@/lib/content-repository";
import { publicCache } from "@/lib/http-cache";
import { publicNewsArticle } from "@/lib/news-text";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const teamId = searchParams.get("teamId");
  const playerId = searchParams.get("playerId");
  const query = searchParams.get("q")?.toLowerCase();
  const snapshot = await loadNewsArticles();
  const articles = snapshot.articles.filter((article) => (!teamId || article.teamIds.includes(teamId)) && (!playerId || article.playerIds.includes(playerId)) && (!query || `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase().includes(query)));
  return Response.json({ data: articles.map(publicNewsArticle), meta: { count: articles.length, source: snapshot.source, syncedAt: snapshot.syncedAt } }, { headers: publicCache(60, 300) });
}

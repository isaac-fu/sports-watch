import { loadNewsArticles } from "@/lib/content-repository";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const snapshot = await loadNewsArticles();
  const article = snapshot.articles.find((item) => item.id === params.id);
  if (!article) return Response.json({ error: "Article not found." }, { status: 404 });
  return Response.json({ data: article, meta: { source: snapshot.source, syncedAt: snapshot.syncedAt } });
}

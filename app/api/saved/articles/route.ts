import { getAccountContext } from "@/lib/auth-session";
import { loadNewsArticles } from "@/lib/content-repository";
import { listSavedArticles, removeSavedArticle, saveArticle } from "@/lib/saved-articles-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  const data = await listSavedArticles(context.accountId);
  return Response.json({ data, meta: { count: data.length } });
}

export async function POST(request: Request) {
  const context = await getAccountContext(request);
  const body = await request.json().catch(() => null) as { articleId?: unknown } | null;
  if (typeof body?.articleId !== "string" || !body.articleId.trim()) return Response.json({ error: "articleId must be a non-empty string." }, { status: 400 });
  const snapshot = await loadNewsArticles();
  const article = snapshot.articles.find((item) => item.id === body.articleId);
  if (!article) return Response.json({ error: "Article not found." }, { status: 404 });
  const data = await saveArticle(context.accountId, article);
  return Response.json({ data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context = await getAccountContext(request);
  const articleId = new URL(request.url).searchParams.get("articleId");
  if (!articleId) return Response.json({ error: "articleId is required." }, { status: 400 });
  await removeSavedArticle(context.accountId, articleId);
  return Response.json({ data: { articleId, saved: false } });
}

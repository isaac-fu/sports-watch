import { getAccountContext } from "@/lib/auth-session";
import { loadNewsArticles } from "@/lib/content-repository";
import { recordNewsFeedback } from "@/lib/news-feedback-repository";

export const dynamic = "force-dynamic";

// Returns { data: Preferences }; the same shape as GET /api/preferences.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const context = await getAccountContext(request);
  if (!context.authenticated) return Response.json({ error: "Sign in to personalize news." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => key !== "interest")
    || (body.interest !== "interested" && body.interest !== "not-interested")
    || !params.id.trim() || params.id.length > 512) {
    return Response.json({ error: "interest must be interested or not-interested." }, { status: 400 });
  }
  try {
    const snapshot = await loadNewsArticles();
    const article = snapshot.articles.find((item) => item.id === params.id);
    if (!article) return Response.json({ error: "Article not found." }, { status: 404 });
    return Response.json({ data: await recordNewsFeedback(context.accountId, article, body.interest) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to save news feedback. Please retry." }, { status: 503 });
  }
}

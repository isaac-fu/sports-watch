import { answerCatchUpQuestion } from "@/lib/catch-up-assistant";
import type { CatchUpMoment } from "@/lib/models";

export const dynamic = "force-dynamic";

const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const windowMs = 60_000;
const requestLimit = 12;

declare global { var __catchUpAssistantRequests: Map<string, number[]> | undefined; }
const requests = globalThis.__catchUpAssistantRequests ?? (globalThis.__catchUpAssistantRequests = new Map());

function rateLimited(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const cutoff = Date.now() - windowMs;
  const recent = (requests.get(key) ?? []).filter((timestamp: number) => timestamp > cutoff);
  if (recent.length >= requestLimit) return true;
  recent.push(Date.now());
  requests.set(key, recent);
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(request)) return Response.json({ error: "Too many assistant questions. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  const body = await request.json().catch(() => null) as { question?: unknown; moment?: Partial<CatchUpMoment> } | null;
  const question = clean(body?.question, 500);
  const moment: CatchUpMoment = {
    id: clean(body?.moment?.id, 120),
    title: clean(body?.moment?.title, 300),
    detail: clean(body?.moment?.detail, 2_000),
    reason: clean(body?.moment?.reason, 300),
    context: clean(body?.moment?.context, 500) || undefined,
    importanceScore: Number(body?.moment?.importanceScore) || 0,
    source: body?.moment?.source === "game-event" ? "game-event" : "news",
  };
  if (!question) return Response.json({ error: "Ask a question about this update." }, { status: 400 });
  if (!moment.title || !moment.detail) return Response.json({ error: "This catch-up update is incomplete." }, { status: 400 });

  try {
    const data = await answerCatchUpQuestion(moment, question);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The catch-up assistant is unavailable right now." }, { status: 502 });
  }
}

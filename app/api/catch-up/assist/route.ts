import { answerCatchUpQuestion } from "@/lib/catch-up-assistant";
import { loadNewsArticles, loadSeasonStats } from "@/lib/content-repository";
import { getGameCenter } from "@/lib/game-center-service";
import { getCachedBoxScore } from "@/lib/box-score-service";
import { boxScoreHighlights } from "@/lib/box-score-highlights";
import { createDefaultPreferences } from "@/lib/store";
import type { CatchUpMoment, NewsArticle } from "@/lib/models";
import { currentNbaSeasonStart } from "@/lib/season";

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

function newsReason(article: NewsArticle) {
  if (article.tags.includes("injury")) return "Important availability update";
  if (article.tags.includes("performance")) return "Standout player performance";
  if (article.tags.includes("roster")) return "Important roster development";
  return "Recent NBA development";
}

export async function POST(request: Request) {
  if (rateLimited(request)) return Response.json({ error: "Too many assistant questions. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  const body = await request.json().catch(() => null) as { question?: unknown; momentId?: unknown; momentSource?: unknown; gameId?: unknown } | null;
  const question = clean(body?.question, 500);
  const momentId = clean(body?.momentId, 120);
  const momentSource = body?.momentSource === "box-score" ? "box-score" : body?.momentSource === "news" ? "news" : null;
  if (!question) return Response.json({ error: "Ask a question about this update." }, { status: 400 });
  if (!momentId || !momentSource) return Response.json({ error: "This catch-up update is incomplete." }, { status: 400 });

  try {
    let moment: CatchUpMoment;
    let article: NewsArticle | undefined;
    let relevantStats: string[] = [];
    if (momentSource === "news") {
      const [news, stats] = await Promise.all([loadNewsArticles(), loadSeasonStats(currentNbaSeasonStart())]);
      article = news.articles.find((candidate) => candidate.id === momentId);
      if (!article) return Response.json({ error: "Article not found." }, { status: 404 });
      moment = { id: article.id, title: article.title, detail: article.summary, reason: newsReason(article), importanceScore: 0, source: "news" };
      if (stats.source !== "mock-repository") {
        const players = stats.players.filter((player) => article?.playerIds.includes(player.playerId)).slice(0, 5)
          .map((player) => `${player.playerName} (${player.teamName}): ${player.pointsPerGame} PPG, ${player.reboundsPerGame} RPG, ${player.assistsPerGame} APG in ${player.gamesPlayed} games.`);
        const teams = stats.teams.filter((team) => article?.teamIds.includes(team.teamId)).slice(0, 3)
          .map((team) => `${team.teamName}: ${team.wins}-${team.losses}, ${team.pointsPerGame} points scored and ${team.pointsAllowedPerGame} points allowed per game.`);
        relevantStats = [...players, ...teams];
      }
    } else {
      const gameId = clean(body?.gameId, 120);
      if (!gameId) return Response.json({ error: "The game context for this update is missing." }, { status: 400 });
      const center = await getGameCenter(gameId).catch(() => null);
      const box = center ? await getCachedBoxScore(center.game) : null;
      const gameMoment = center ? boxScoreHighlights(center.game, box, createDefaultPreferences(false), 100).find((item) => item.id === momentId) : null;
      if (!center || !gameMoment) return Response.json({ error: "Game update not found." }, { status: 404 });
      moment = gameMoment;
      relevantStats = [gameMoment.detail];
    }
    const data = await answerCatchUpQuestion(moment, question, { article, relevantStats });
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The catch-up assistant is unavailable right now." }, { status: 502 });
  }
}

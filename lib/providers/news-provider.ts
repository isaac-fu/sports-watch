import { createHash } from "node:crypto";
import type { NewsArticle } from "@/lib/models";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { mockNews } from "@/lib/mock-repository";
import { classifyAndTagNews } from "@/lib/news-classifier";

export interface NewsProvider {
  readonly name: string;
  getLatestArticles(): Promise<NewsArticle[]>;
}

type NewsApiArticle = {
  source?: { name?: string };
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
};

type NewsApiResponse = { status?: string; articles?: NewsApiArticle[]; message?: string };
function classifyText(...parts: Array<string | undefined>) {
  return classifyAndTagNews(parts, canonicalTeams, canonicalPlayers);
}

function mapArticle(article: NewsApiArticle): NewsArticle | null {
  if (!article.title || !article.url || !article.publishedAt) return null;
  const classified = classifyText(article.title, article.description, article.content, article.url, article.source?.name);
  if (!classified.nbaRelated) return null;
  return {
    id: `newsapi-${createHash("sha256").update(article.url).digest("hex").slice(0, 20)}`,
    title: article.title,
    summary: article.description?.trim() || "Open the article for the full story.",
    source: article.source?.name?.trim() || "NewsAPI",
    publishedAt: new Date(article.publishedAt).toISOString(),
    url: article.url,
    imageUrl: article.urlToImage || undefined,
    teamIds: classified.teamIds,
    playerIds: classified.playerIds,
    tags: classified.tags,
  };
}

export class NewsApiProvider implements NewsProvider {
  readonly name = "newsapi";

  constructor(private readonly apiKey: string, private readonly baseUrl = "https://newsapi.org/v2") {}

  async getLatestArticles() {
    const params = new URLSearchParams({
      q: '(NBA OR "National Basketball Association")',
      searchIn: "title,description",
      language: "en",
      sortBy: "publishedAt",
      pageSize: "50",
    });
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/everything?${params}`, {
      headers: { "X-Api-Key": this.apiKey },
      cache: "no-store",
    });
    const payload = await response.json() as NewsApiResponse;
    if (!response.ok || payload.status === "error") throw new Error(payload.message || `NewsAPI request failed with ${response.status}`);
    return (payload.articles ?? []).map(mapArticle).filter((article): article is NewsArticle => article !== null);
  }
}

export const mockNewsProvider: NewsProvider = {
  name: "mock-repository",
  async getLatestArticles() { return mockNews; },
};

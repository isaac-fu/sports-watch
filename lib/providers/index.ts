import { BallDontLieProvider } from "./balldontlie-provider";
import { mockProvider } from "./mock-provider";
import type { CatalogProvider, NbaProvider } from "./types";
import { mockNewsProvider, NewsApiProvider, type NewsProvider } from "./news-provider";
import { CompositeNewsProvider } from "./composite-news-provider";
import { RssNewsProvider } from "./rss-news-provider";
import { BallDontLieStatsProvider, mockStatsProvider, type StatsProvider } from "./stats-provider";
import { NbaApiProvider } from "./nba-api-provider";

const unavailableSportsProvider = (selected: string): NbaProvider => ({
  name: `${selected}-unavailable`,
  async getGames() { throw new Error(`${selected} sports provider is not configured.`); },
  async getGame() { throw new Error(`${selected} sports provider is not configured.`); },
  async getGameEvents() { throw new Error(`${selected} sports provider is not configured.`); },
});

function nbaApiProvider() {
  const parsedTimeout = Number(process.env.NBA_API_SERVICE_TIMEOUT_MS ?? "120000");
  return new NbaApiProvider({
    baseUrl: process.env.NBA_API_SERVICE_URL,
    timeoutMs: Number.isFinite(parsedTimeout) ? parsedTimeout : undefined,
  });
}

export function getNbaProvider(): NbaProvider {
  const selected = (process.env.SPORTS_DATA_PROVIDER ?? "mock").trim().toLowerCase();
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (selected === "mock") return mockProvider;
  if (selected === "balldontlie" && apiKey) return new BallDontLieProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return unavailableSportsProvider(selected);
}

export function getCatalogProvider(): CatalogProvider | null {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  const selected = process.env.CATALOG_DATA_PROVIDER ?? process.env.SPORTS_DATA_PROVIDER;
  if (selected === "nba_api") return nbaApiProvider();
  if (selected === "balldontlie" && apiKey) return new BallDontLieProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return null;
}

export function getNewsProvider(): NewsProvider {
  const selected = process.env.NEWS_DATA_PROVIDER ?? "rss-newsapi";
  const rss = new RssNewsProvider();
  const newsApi = process.env.NEWS_API_KEY ? new NewsApiProvider(process.env.NEWS_API_KEY, process.env.NEWS_API_BASE_URL) : null;
  if (selected === "mock") return mockNewsProvider;
  if (selected === "newsapi") return newsApi ?? rss;
  if (selected === "rss") return rss;
  return newsApi ? new CompositeNewsProvider([rss, newsApi]) : rss;
}

export function getStatsProvider(): StatsProvider {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (process.env.STATS_DATA_PROVIDER === "nba_api") return nbaApiProvider();
  if (process.env.STATS_DATA_PROVIDER === "balldontlie" && apiKey) return new BallDontLieStatsProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return mockStatsProvider;
}

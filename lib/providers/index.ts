import { BallDontLieProvider } from "./balldontlie-provider";
import { mockProvider } from "./mock-provider";
import type { CatalogProvider, NbaProvider } from "./types";
import { mockNewsProvider, NewsApiProvider, type NewsProvider } from "./news-provider";
import { BallDontLieStatsProvider, mockStatsProvider, type StatsProvider } from "./stats-provider";
import { NbaApiProvider } from "./nba-api-provider";

function nbaApiProvider() {
  const parsedTimeout = Number(process.env.NBA_API_SERVICE_TIMEOUT_MS ?? "120000");
  return new NbaApiProvider({
    baseUrl: process.env.NBA_API_SERVICE_URL,
    timeoutMs: Number.isFinite(parsedTimeout) ? parsedTimeout : undefined,
  });
}

export function getNbaProvider(): NbaProvider {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (process.env.SPORTS_DATA_PROVIDER === "balldontlie" && apiKey) return new BallDontLieProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return mockProvider;
}

export function getCatalogProvider(): CatalogProvider | null {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  const selected = process.env.CATALOG_DATA_PROVIDER ?? process.env.SPORTS_DATA_PROVIDER;
  if (selected === "nba_api") return nbaApiProvider();
  if (selected === "balldontlie" && apiKey) return new BallDontLieProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return null;
}

export function getNewsProvider(): NewsProvider {
  const apiKey = process.env.NEWS_API_KEY;
  if (process.env.NEWS_DATA_PROVIDER === "newsapi" && apiKey) return new NewsApiProvider(apiKey, process.env.NEWS_API_BASE_URL);
  return mockNewsProvider;
}

export function getStatsProvider(): StatsProvider {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (process.env.STATS_DATA_PROVIDER === "nba_api") return nbaApiProvider();
  if (process.env.STATS_DATA_PROVIDER === "balldontlie" && apiKey) return new BallDontLieStatsProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return mockStatsProvider;
}

import { BallDontLieProvider } from "./balldontlie-provider";
import { mockProvider } from "./mock-provider";
import type { NbaProvider } from "./types";
import { mockNewsProvider, NewsApiProvider, type NewsProvider } from "./news-provider";
import { BallDontLieStatsProvider, mockStatsProvider, type StatsProvider } from "./stats-provider";

export function getNbaProvider(): NbaProvider {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (process.env.SPORTS_DATA_PROVIDER === "balldontlie" && apiKey) return new BallDontLieProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return mockProvider;
}

export function getNewsProvider(): NewsProvider {
  const apiKey = process.env.NEWS_API_KEY;
  if (process.env.NEWS_DATA_PROVIDER === "newsapi" && apiKey) return new NewsApiProvider(apiKey, process.env.NEWS_API_BASE_URL);
  return mockNewsProvider;
}

export function getStatsProvider(): StatsProvider {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (process.env.STATS_DATA_PROVIDER === "balldontlie" && apiKey) return new BallDontLieStatsProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return mockStatsProvider;
}

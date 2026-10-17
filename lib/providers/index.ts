import { BallDontLieProvider } from "./balldontlie-provider";
import { mockProvider } from "./mock-provider";
import type { NbaProvider } from "./types";

export function getNbaProvider(): NbaProvider {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (process.env.SPORTS_DATA_PROVIDER === "balldontlie" && apiKey) return new BallDontLieProvider(apiKey, process.env.BALLDONTLIE_BASE_URL);
  return mockProvider;
}

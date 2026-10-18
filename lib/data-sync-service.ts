import type { SyncResult } from "./models";
import { saveNewsArticles, saveSeasonStats, recordSyncResult } from "./content-repository";
import { getNewsProvider, getStatsProvider } from "./providers";
import { mockNewsProvider } from "./providers/news-provider";
import { mockStatsProvider } from "./providers/stats-provider";
import { currentNbaSeasonStart } from "./season";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown provider error";

async function syncNews(): Promise<SyncResult> {
  const selected = getNewsProvider();
  const syncedAt = new Date().toISOString();
  try {
    const articles = await selected.getLatestArticles();
    if (articles.length === 0) throw new Error(`${selected.name} returned no NBA articles.`);
    await saveNewsArticles(articles, selected.name);
    return { domain: "news", provider: selected.name, status: "success", itemCount: articles.length, syncedAt };
  } catch (error) {
    const articles = await mockNewsProvider.getLatestArticles();
    await saveNewsArticles(articles, mockNewsProvider.name);
    return { domain: "news", provider: mockNewsProvider.name, status: "fallback", itemCount: articles.length, syncedAt, error: errorMessage(error) };
  }
}

async function syncStats(): Promise<SyncResult> {
  const selected = getStatsProvider();
  const season = currentNbaSeasonStart();
  const syncedAt = new Date().toISOString();
  try {
    const stats = await selected.getSeasonStats(season);
    await saveSeasonStats(season, stats, selected.name);
    return { domain: "stats", provider: selected.name, status: "success", itemCount: stats.players.length + stats.teams.length, syncedAt };
  } catch (error) {
    const stats = await mockStatsProvider.getSeasonStats(season);
    await saveSeasonStats(season, stats, mockStatsProvider.name);
    return { domain: "stats", provider: mockStatsProvider.name, status: "fallback", itemCount: stats.players.length + stats.teams.length, syncedAt, error: errorMessage(error) };
  }
}

export async function syncExternalData() {
  const results = await Promise.all([syncNews(), syncStats()]);
  await Promise.all(results.map(recordSyncResult));
  return results;
}

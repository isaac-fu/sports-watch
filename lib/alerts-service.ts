import type { Game, GameCenter } from "./models";
import { deliverAlertCandidates, listDeliveredAlerts, markAlertsRead } from "./alerts-repository";
import { getGames } from "./mock-repository";
import { getCurrentPreferences } from "./preferences-repository";
import { getNbaProvider } from "./providers";
import { getRankedAlertCandidates } from "./recommendations/service";
import { loadNewsArticles } from "./content-repository";
import { listAccountIds } from "./auth-repository";
import { getGameCenter } from "./game-center-service";
import { loadCatalog } from "./catalog-repository";

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

async function loadAlertWindowGames() {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setDate(to.getDate() + 1);
  let games: Game[];
  try {
    games = await getNbaProvider().getGames({ from: toDateKey(from), to: toDateKey(to) });
  } catch {
    games = getGames({ from: toDateKey(from), to: toDateKey(to) });
  }
  return games;
}

async function loadLiveGameCenters(games: Game[]): Promise<GameCenter[]> {
  const centers = await Promise.all(games
    .filter((game) => game.status === "live")
    .map((game) => getGameCenter(game.id).catch(() => null)));
  return centers.filter((center): center is GameCenter => center !== null);
}

export async function processAccountAlerts(accountId: string) {
  await loadCatalog();
  const [preferences, games, news] = await Promise.all([getCurrentPreferences(accountId), loadAlertWindowGames(), loadNewsArticles()]);
  const gameCenters = await loadLiveGameCenters(games);
  const candidates = getRankedAlertCandidates(preferences, games, news.articles, gameCenters);
  const delivered = await deliverAlertCandidates(accountId, candidates);
  return { candidates, delivered };
}

export async function processAllAccountAlerts() {
  await loadCatalog();
  const [accountIds, games, news] = await Promise.all([listAccountIds(), loadAlertWindowGames(), loadNewsArticles()]);
  const gameCenters = await loadLiveGameCenters(games);
  const results = await Promise.all(accountIds.map(async (accountId) => {
    const preferences = await getCurrentPreferences(accountId);
    const candidates = getRankedAlertCandidates(preferences, games, news.articles, gameCenters);
    const delivered = await deliverAlertCandidates(accountId, candidates);
    return { accountId, candidates, delivered };
  }));
  return {
    accountCount: results.length,
    candidateCount: results.reduce((total, result) => total + result.candidates.length, 0),
    deliveredCount: results.reduce((total, result) => total + result.delivered.length, 0),
  };
}

export async function getAccountAlerts(accountId: string) {
  return listDeliveredAlerts(accountId);
}

export async function readAccountAlerts(accountId: string, id?: string) {
  return markAlertsRead(accountId, id);
}

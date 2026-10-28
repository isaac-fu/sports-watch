import { gameCatchUpStory } from "@/lib/box-score-highlights";
import type { GameBoxScore } from "@/lib/box-score";
import type { CatchUpBrief, Game, GameCenter, NewsArticle, Preferences, SavedArticle } from "@/lib/models";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { mockNews } from "@/lib/mock-repository";
import { generateAlertCandidates, generateGameCandidates, generateNewsCandidates, generatePlayerCandidates, generateTeamCandidates } from "./candidate-generators";
import { rankAlertCandidates, rankCatchUpCandidates, rankGameCandidates, rankNewsCandidates, rankPlayerCandidates, rankTeamCandidates } from "./rankers";

const feedBackfillTarget = 8;
const recentNewsWindowMs = 7 * 24 * 60 * 60 * 1000;

export function getPersonalizedFeed(preferences: Preferences, articles: NewsArticle[] = mockNews, savedArticles: SavedArticle[] = []) {
  const personalized = rankNewsCandidates(generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences, savedArticles));
  if (articles.length === 0) return personalized;
  const savedIds = new Set(savedArticles.map((article) => article.id));
  const popular = rankNewsCandidates(generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, {
    ...preferences,
    followedTeamIds: [],
    followedPlayerIds: [],
  })).filter((item) => !savedIds.has(item.id));
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 && savedArticles.length === 0;
  if (coldStart || personalized.length >= feedBackfillTarget) return coldStart ? popular : personalized;

  const recentCutoff = Date.now() - recentNewsWindowMs;
  const combined = [...personalized];
  const seenIds = new Set(combined.map((item) => item.id));
  const seenTitles = new Set(combined.map((item) => item.title.toLowerCase().replace(/[^a-z0-9]/g, "")));
  for (const item of popular) {
    const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (combined.length >= feedBackfillTarget) break;
    if (new Date(item.publishedAt).getTime() < recentCutoff || seenIds.has(item.id) || seenTitles.has(titleKey)) continue;
    combined.push(item);
    seenIds.add(item.id);
    seenTitles.add(titleKey);
  }
  return combined.sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime() || right.relevanceScore - left.relevanceScore);
}

export function getDiscoveryRecommendations(preferences: Preferences, games: Game[], articles: NewsArticle[] = mockNews, savedArticles: SavedArticle[] = []) {
  const inputs = { teams: canonicalTeams, players: canonicalPlayers, articles, games, savedArticles };
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 && savedArticles.length === 0;
  return {
    teams: rankTeamCandidates(generateTeamCandidates(inputs, preferences)),
    players: rankPlayerCandidates(generatePlayerCandidates(inputs, preferences)),
    games: coldStart ? rankGameCandidates(generateGameCandidates(inputs)) : [],
  };
}

const gameRecency = (game: Game) => game.updatedAt ?? `${game.date}T23:59:59.000Z`;

export function selectCatchUpGame(preferences: Preferences, games: Game[]) {
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0;
  const followedPlayerTeamIds = new Set(canonicalPlayers.filter((player) => preferences.followedPlayerIds.includes(player.id)).map((player) => player.teamId));
  const followsGame = (game: Game) => preferences.followedTeamIds.includes(game.home.id)
    || preferences.followedTeamIds.includes(game.away.id)
    || followedPlayerTeamIds.has(game.home.id)
    || followedPlayerTeamIds.has(game.away.id);
  return games
    .filter((game) => game.status !== "scheduled" && (coldStart || followsGame(game)))
    .sort((left, right) => Number(right.status === "live") - Number(left.status === "live") || gameRecency(right).localeCompare(gameRecency(left)))[0] ?? null;
}

export function getCatchUpBrief(preferences: Preferences, games: Game[], articles: NewsArticle[] = mockNews, gameCenter: GameCenter | null = null, savedArticles: SavedArticle[] = [], box: GameBoxScore | null = null): CatchUpBrief {
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0;
  const relevantGame = gameCenter ? (gameCenter.game.status !== "scheduled" ? gameCenter.game : null) : selectCatchUpGame(preferences, games);
  const gameStory = relevantGame ? gameCatchUpStory(relevantGame, box, preferences) : null;
  const gameMoments = gameStory ? [gameStory] : [];
  const newsMoments = rankCatchUpCandidates(generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences, savedArticles));
  const moments = [...gameMoments, ...newsMoments].slice(0, 3);
  const source: CatchUpBrief["source"] = gameMoments.length > 0 ? "box-score" : "news";
  const followedPlayerTeamIds = new Set(canonicalPlayers.filter((player) => preferences.followedPlayerIds.includes(player.id)).map((player) => player.teamId));
  const focusTeam = !coldStart && relevantGame
    ? [relevantGame.home, relevantGame.away].find((team) => preferences.followedTeamIds.includes(team.id) || followedPlayerTeamIds.has(team.id))
    : !coldStart ? canonicalTeams.find((team) => preferences.followedTeamIds.includes(team.id) || followedPlayerTeamIds.has(team.id)) : undefined;

  const lede = gameStory ? gameStory.title : moments[0]?.detail ?? "There are no significant updates for your favorites yet.";

  return {
    title: focusTeam ? `${focusTeam.short} catch-up` : coldStart ? "NBA catch-up" : "Your NBA catch-up",
    lede,
    readTimeMinutes: Math.max(1, Math.min(3, moments.length)),
    generatedAt: new Date().toISOString(),
    game: relevantGame,
    moments,
    source,
  };
}

export function getRankedAlertCandidates(preferences: Preferences, games: Game[], articles: NewsArticle[] = mockNews, gameCenters: GameCenter[] = []) {
  return rankAlertCandidates(generateAlertCandidates(games, articles, preferences, gameCenters));
}

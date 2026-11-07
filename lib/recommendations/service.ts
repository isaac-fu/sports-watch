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
  const personalized = generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences, savedArticles);
  const popular = generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, {
    ...preferences, followedTeamIds: [], followedPlayerIds: [],
  }, savedArticles);
  const personalStories = new Set(personalized.map((candidate) => candidate.article.storyId ?? candidate.article.id));
  const candidates = new Map(popular.map((candidate) => [candidate.article.id, candidate]));
  for (const candidate of personalized) candidates.set(candidate.article.id, candidate);
  // Rank and collapse the combined pool before counting backfill slots.
  const ranked = rankNewsCandidates(Array.from(candidates.values()));
  const byId = new Map(articles.map((article) => [article.id, article]));
  const personal = ranked.filter((item) => personalStories.has(byId.get(item.id)?.storyId ?? item.id));
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 && savedArticles.length === 0;
  if (coldStart) return ranked;
  const ids = new Set(personal.map((item) => item.id));
  const extra = ranked.filter((item) => !ids.has(item.id) && Date.parse(item.publishedAt) >= Date.now() - recentNewsWindowMs);
  return [...personal, ...extra.slice(0, Math.max(0, feedBackfillTarget - personal.length))]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.relevanceScore - a.relevanceScore);
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

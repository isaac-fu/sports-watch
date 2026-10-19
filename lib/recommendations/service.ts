import type { CatchUpBrief, Game, GameCenter, NewsArticle, Preferences } from "@/lib/models";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { mockNews } from "@/lib/mock-repository";
import { generateAlertCandidates, generateGameCandidates, generateGameEventCandidates, generateNewsCandidates, generatePlayerCandidates, generateTeamCandidates } from "./candidate-generators";
import { rankAlertCandidates, rankCatchUpCandidates, rankGameCandidates, rankGameEventCandidates, rankNewsCandidates, rankPlayerCandidates, rankTeamCandidates } from "./rankers";

export function getPersonalizedFeed(preferences: Preferences, articles: NewsArticle[] = mockNews) {
  return rankNewsCandidates(generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences));
}

export function getDiscoveryRecommendations(preferences: Preferences, games: Game[], articles: NewsArticle[] = mockNews) {
  const inputs = { teams: canonicalTeams, players: canonicalPlayers, articles, games };
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0;
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

export function getCatchUpBrief(preferences: Preferences, games: Game[], articles: NewsArticle[] = mockNews, gameCenter: GameCenter | null = null): CatchUpBrief {
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0;
  const relevantGame = gameCenter ? (gameCenter.game.status !== "scheduled" ? gameCenter.game : null) : selectCatchUpGame(preferences, games);
  const eventMoments = gameCenter && relevantGame?.id === gameCenter.game.id
    ? rankGameEventCandidates(generateGameEventCandidates(gameCenter, preferences))
    : [];
  const newsMoments = rankCatchUpCandidates(generateNewsCandidates(articles, canonicalTeams, canonicalPlayers, preferences));
  const moments = eventMoments.length > 0 ? eventMoments : newsMoments;
  const source: CatchUpBrief["source"] = eventMoments.length > 0 ? "play-by-play" : "news";
  const followedPlayerTeamIds = new Set(canonicalPlayers.filter((player) => preferences.followedPlayerIds.includes(player.id)).map((player) => player.teamId));
  const focusTeam = !coldStart && relevantGame
    ? [relevantGame.home, relevantGame.away].find((team) => preferences.followedTeamIds.includes(team.id) || followedPlayerTeamIds.has(team.id))
    : !coldStart ? canonicalTeams.find((team) => preferences.followedTeamIds.includes(team.id) || followedPlayerTeamIds.has(team.id)) : undefined;

  let lede = moments.length > 0 ? moments[0].detail : "There are no significant updates for your favorites yet.";
  if (relevantGame?.homeScore !== undefined && relevantGame.awayScore !== undefined) {
    if (relevantGame.status === "live") {
      const period = (relevantGame.period ?? 0) > 4 ? `OT${(relevantGame.period ?? 4) - 4}` : relevantGame.period === 4 ? "the fourth quarter" : `Q${relevantGame.period ?? "—"}`;
      lede = `${relevantGame.away.short} ${relevantGame.awayScore}, ${relevantGame.home.short} ${relevantGame.homeScore} in ${period}${relevantGame.clock ? ` with ${relevantGame.clock} left` : ""}. ${lede}`;
    } else {
      const homeWon = relevantGame.homeScore > relevantGame.awayScore;
      const winner = homeWon ? relevantGame.home : relevantGame.away;
      const loser = homeWon ? relevantGame.away : relevantGame.home;
      const winnerScore = homeWon ? relevantGame.homeScore : relevantGame.awayScore;
      const loserScore = homeWon ? relevantGame.awayScore : relevantGame.homeScore;
      lede = `${winner.name} beat ${loser.name} ${winnerScore}–${loserScore}. ${lede}`;
    }
  }

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

import type { AlertCandidate, Game, GameCenter, NewsArticle, Player, Preferences, SavedArticle, Team } from "@/lib/models";
import { canonicalPlayers } from "@/lib/catalog";
import { formatPacificTipTime, scheduledGameTimestamp } from "@/lib/game-time";
import { classifyNewsText } from "@/lib/news-classifier";
import type { GameCandidate, GameEventCandidate, NewsCandidate, PlayerCandidate, RecommendationInputs, TeamCandidate } from "./types";

const nationallyVisible = (game: Game) => ["ABC", "ESPN", "TNT", "NBA TV"].includes(game.network.toUpperCase());

function importanceFor(article: NewsArticle) {
  if (article.tags.includes("injury")) return 15;
  if (article.tags.includes("performance")) return 11;
  if (article.tags.includes("game recap")) return 9;
  if (article.tags.includes("storyline")) return 7;
  return 4;
}

export function generateNewsCandidates(articles: NewsArticle[], teams: Team[], players: Player[], preferences: Preferences, savedArticles: SavedArticle[] = []): NewsCandidate[] {
  const savedIds = new Set(savedArticles.map((article) => article.id));
  const savedTeamIds = new Set(savedArticles.flatMap((article) => article.teamIds));
  const savedPlayerIds = new Set(savedArticles.flatMap((article) => article.playerIds));
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0 && savedArticles.length === 0;
  return articles.flatMap((article) => {
    if (savedIds.has(article.id)) return [];
    const inferred = classifyNewsText([article.title, article.summary, article.source, article.url], teams, players);
    const articleTeamIds = new Set([...article.teamIds, ...inferred.teamIds]);
    const articlePlayerIds = new Set([...article.playerIds, ...inferred.playerIds]);
    if (articleTeamIds.size === 0 && articlePlayerIds.size === 0 && !inferred.nbaRelated) return [];
    const matchedTeams = teams.filter((team) => preferences.followedTeamIds.includes(team.id) && articleTeamIds.has(team.id));
    const matchedPlayers = players.filter((player) => preferences.followedPlayerIds.includes(player.id) && articlePlayerIds.has(player.id));
    const savedInterestScore = Array.from(articleTeamIds).filter((id) => savedTeamIds.has(id)).length * 18
      + Array.from(articlePlayerIds).filter((id) => savedPlayerIds.has(id)).length * 30;
    const importanceScore = importanceFor(article);
    const sources: NewsCandidate["sources"] = [];
    if (matchedTeams.length) sources.push("followed-team");
    if (matchedPlayers.length) sources.push("followed-player");
    if (savedInterestScore > 0) sources.push("saved-interest");
    if (importanceScore >= 15) sources.push("important-league-update");
    if (coldStart) sources.push("popular-league-update");
    if (sources.length === 0) return [];

    return [{
      article: { ...article, teamIds: Array.from(articleTeamIds), playerIds: Array.from(articlePlayerIds) },
      matchedTeams,
      matchedPlayers,
      freshnessHours: Math.max(0, (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000),
      importanceScore,
      sourceQualityScore: article.source.startsWith("Sports Watch") ? 8 : 6,
      savedInterestScore,
      sources,
    }];
  });
}

export function generateTeamCandidates(inputs: RecommendationInputs, preferences: Preferences): TeamCandidate[] {
  const followedPlayers = inputs.players.filter((player) => preferences.followedPlayerIds.includes(player.id));
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0;
  return inputs.teams.filter((team) => !preferences.followedTeamIds.includes(team.id)).map((team) => ({
    team,
    followedPlayerCount: followedPlayers.filter((player) => player.teamId === team.id).length,
    upcomingOpponentCount: inputs.games.filter((game) => {
      const featuresTeam = game.home.id === team.id || game.away.id === team.id;
      const featuresFollowedTeam = preferences.followedTeamIds.includes(game.home.id) || preferences.followedTeamIds.includes(game.away.id);
      return featuresTeam && featuresFollowedTeam;
    }).length,
    articleMentionCount: inputs.articles.filter((article) => article.teamIds.includes(team.id)).length,
    nationalGameCount: inputs.games.filter((game) => nationallyVisible(game) && (game.home.id === team.id || game.away.id === team.id)).length,
    savedArticleMentionCount: inputs.savedArticles.filter((article) => article.teamIds.includes(team.id)).length,
    coldStart,
  }));
}

export function generatePlayerCandidates(inputs: RecommendationInputs, preferences: Preferences): PlayerCandidate[] {
  const coldStart = preferences.followedTeamIds.length === 0 && preferences.followedPlayerIds.length === 0;
  const opponentTeamIds = new Set(inputs.games.flatMap((game) => {
    if (preferences.followedTeamIds.includes(game.home.id)) return [game.away.id];
    if (preferences.followedTeamIds.includes(game.away.id)) return [game.home.id];
    return [];
  }));
  return inputs.players.filter((player) => !preferences.followedPlayerIds.includes(player.id)).map((player) => ({
    player,
    playsForFollowedTeam: preferences.followedTeamIds.includes(player.teamId),
    upcomingOpponent: opponentTeamIds.has(player.teamId),
    articleMentionCount: inputs.articles.filter((article) => article.playerIds.includes(player.id)).length,
    teamNationalGameCount: inputs.games.filter((game) => nationallyVisible(game) && (game.home.id === player.teamId || game.away.id === player.teamId)).length,
    savedArticleMentionCount: inputs.savedArticles.filter((article) => article.playerIds.includes(player.id)).length,
    coldStart,
  }));
}

export function generateGameCandidates(inputs: RecommendationInputs): GameCandidate[] {
  return inputs.games.map((game) => {
    const teamIds = [game.home.id, game.away.id];
    const broadcastScore = game.network.toUpperCase() === "ABC" ? 28 : ["ESPN", "TNT"].includes(game.network.toUpperCase()) ? 23 : game.network.toUpperCase() === "NBA TV" ? 14 : 5;
    const statusScore = game.status === "live" ? 40 : game.status === "scheduled" ? 12 : 4;
    return {
      game,
      articleMentionCount: inputs.articles.filter((article) => article.teamIds.some((teamId) => teamIds.includes(teamId))).length,
      broadcastScore,
      statusScore,
    };
  });
}

export function generateGameEventCandidates(gameCenter: GameCenter, preferences: Preferences): GameEventCandidate[] {
  return gameCenter.events
    .filter((event) => event.type !== "play" && event.importanceScore >= 20)
    .map((event) => ({
      event,
      game: gameCenter.game,
      followedTeamMatch: Boolean(event.teamId && preferences.followedTeamIds.includes(event.teamId)),
      followedPlayerMatch: event.playerIds.some((playerId) => preferences.followedPlayerIds.includes(playerId)),
    }));
}

function eventContext(game: Game, event: GameCenter["events"][number]) {
  const score = event.homeScore !== undefined && event.awayScore !== undefined
    ? ` ${game.away.short} ${event.awayScore}, ${game.home.short} ${event.homeScore}.`
    : "";
  return `${event.description} ${event.periodLabel}${event.clock ? `, ${event.clock}` : ""}.${score}`.trim();
}

function clockSeconds(clock: string) {
  const match = clock.match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.POSITIVE_INFINITY;
}

export function generateAlertCandidates(games: Game[], articles: NewsArticle[], preferences: Preferences, gameCenters: GameCenter[] = []): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const followedPlayerTeamIds = new Set(canonicalPlayers
    .filter((player) => preferences.followedPlayerIds.includes(player.id))
    .map((player) => player.teamId));
  const relevantGame = (game: Game) => preferences.followedTeamIds.includes(game.home.id)
    || preferences.followedTeamIds.includes(game.away.id)
    || followedPlayerTeamIds.has(game.home.id)
    || followedPlayerTeamIds.has(game.away.id);

  for (const game of games.filter(relevantGame)) {
    const scoreDifference = game.homeScore !== undefined && game.awayScore !== undefined ? Math.abs(game.homeScore - game.awayScore) : undefined;
    if (preferences.alerts.closeGame && game.status === "live" && (game.period ?? 0) >= 4 && scoreDifference !== undefined && scoreDifference <= 5) {
      candidates.push({ candidateId: `close:${game.id}:q${game.period ?? 4}`, type: "closeGame", title: `${game.away.short}–${game.home.short} is coming down to the wire`, body: `${game.away.short} ${game.awayScore}, ${game.home.short} ${game.homeScore} with ${game.clock ?? "the fourth quarter"} remaining.`, priority: 100, occurredAt: game.updatedAt ?? new Date().toISOString(), gameId: game.id, teamIds: [game.home.id, game.away.id], playerIds: [] });
    }
    if (preferences.alerts.finalScore && game.status === "final" && game.homeScore !== undefined && game.awayScore !== undefined) {
      candidates.push({ candidateId: `final:${game.id}`, type: "finalScore", title: `Final: ${game.away.short} ${game.awayScore}, ${game.home.short} ${game.homeScore}`, body: `${game.home.name} and ${game.away.name} have finished at ${game.venue}.`, priority: 85, occurredAt: game.updatedAt ?? `${game.date}T23:59:00.000Z`, gameId: game.id, teamIds: [game.home.id, game.away.id], playerIds: [] });
    }
    if (preferences.alerts.gameStarting && game.status === "scheduled") {
      const start = scheduledGameTimestamp(game);
      const minutesUntilStart = (start - Date.now()) / 60_000;
      if (!Number.isNaN(minutesUntilStart) && minutesUntilStart >= 0 && minutesUntilStart <= 30) {
        candidates.push({ candidateId: `starting:${game.id}`, type: "gameStarting", title: `${game.away.short} at ${game.home.short} starts soon`, body: `Tip-off is at ${formatPacificTipTime(game.startsAt, game.time)} on ${game.network}.`, priority: 90, occurredAt: new Date().toISOString(), gameId: game.id, teamIds: [game.home.id, game.away.id], playerIds: [] });
      }
    }
  }

  if (preferences.alerts.standoutPerformance) {
    for (const article of articles.filter((item) => item.tags.includes("performance") && item.playerIds.some((id) => preferences.followedPlayerIds.includes(id)))) {
      candidates.push({ candidateId: `standout:${article.id}`, type: "standoutPerformance", title: article.title, body: article.summary, priority: 75, occurredAt: article.publishedAt, teamIds: article.teamIds, playerIds: article.playerIds });
    }
  }

  for (const gameCenter of gameCenters.filter((center) => center.game.status === "live" && relevantGame(center.game))) {
    const { game } = gameCenter;
    const events = [...gameCenter.events].sort((left, right) => left.sequence - right.sequence);
    const relevantEvent = (event: GameCenter["events"][number]) => !event.teamId
      || preferences.followedTeamIds.includes(event.teamId)
      || followedPlayerTeamIds.has(event.teamId)
      || event.playerIds.some((playerId) => preferences.followedPlayerIds.includes(playerId));

    if (preferences.alerts.injuryUpdate) {
      for (const event of events.filter((item) => item.type === "injury" && relevantEvent(item))) {
        candidates.push({
          candidateId: `event:injury:${event.id}`,
          type: "injuryUpdate",
          title: event.title,
          body: eventContext(game, event),
          priority: 98,
          occurredAt: event.occurredAt,
          gameId: game.id,
          teamIds: [game.home.id, game.away.id],
          playerIds: event.playerIds,
        });
      }
    }

    if (preferences.alerts.milestone) {
      for (const event of events.filter((item) => item.type === "milestone" && relevantEvent(item))) {
        candidates.push({
          candidateId: `event:milestone:${event.id}`,
          type: "milestone",
          title: event.title,
          body: eventContext(game, event),
          priority: 82,
          occurredAt: event.occurredAt,
          gameId: game.id,
          teamIds: [game.home.id, game.away.id],
          playerIds: event.playerIds,
        });
      }
    }

    if (preferences.alerts.leadChange) {
      let previousLeader: string | null = null;
      let latestLeadChange: GameCenter["events"][number] | null = null;
      for (const event of events) {
        if (event.homeScore === undefined || event.awayScore === undefined || event.homeScore === event.awayScore) continue;
        const leader = event.homeScore > event.awayScore ? game.home.id : game.away.id;
        if (previousLeader && leader !== previousLeader && event.period >= 4) latestLeadChange = event;
        previousLeader = leader;
      }
      if (latestLeadChange) {
        const leader = latestLeadChange.homeScore! > latestLeadChange.awayScore! ? game.home : game.away;
        candidates.push({
          candidateId: `event:lead-change:${latestLeadChange.id}`,
          type: "leadChange",
          title: `${leader.short} takes the lead`,
          body: eventContext(game, latestLeadChange),
          priority: 96,
          occurredAt: latestLeadChange.occurredAt,
          gameId: game.id,
          teamIds: [game.home.id, game.away.id],
          playerIds: latestLeadChange.playerIds,
        });
      }
    }

    if (preferences.alerts.closeGame) {
      const decisiveEvent = [...events].reverse().find((event) => event.period >= 4
        && clockSeconds(event.clock) <= 300
        && event.homeScore !== undefined
        && event.awayScore !== undefined
        && Math.abs(event.homeScore - event.awayScore) <= 5
        && event.importanceScore >= 70
        && ["score", "turnover", "milestone"].includes(event.type));
      if (decisiveEvent) {
        candidates.push({
          candidateId: `event:decisive:${decisiveEvent.id}`,
          type: "closeGame",
          title: decisiveEvent.title,
          body: eventContext(game, decisiveEvent),
          priority: 101,
          occurredAt: decisiveEvent.occurredAt,
          gameId: game.id,
          teamIds: [game.home.id, game.away.id],
          playerIds: decisiveEvent.playerIds,
        });
      }
    }
  }
  return candidates;
}

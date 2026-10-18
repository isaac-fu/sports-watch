import type { AlertCandidate, CatchUpMoment, FeedItem } from "@/lib/models";
import type { GameCandidate, GameEventCandidate, GameRecommendation, NewsCandidate, PlayerCandidate, PlayerRecommendation, TeamCandidate, TeamRecommendation } from "./types";

export function rankNewsCandidates(candidates: NewsCandidate[]): FeedItem[] {
  const ranked = candidates.map(({ article, matchedPlayers, matchedTeams, freshnessHours, importanceScore, sourceQualityScore, sources }) => {
    const freshnessScore = Math.max(0, 15 - Math.floor(freshnessHours));
    const coldStart = sources.includes("popular-league-update");
    const relevanceScore = Math.min(100, coldStart
      ? freshnessScore + importanceScore * 3 + sourceQualityScore * 2
      : matchedPlayers.length * 45 + matchedTeams.length * 25 + freshnessScore + importanceScore + sourceQualityScore);
    const isPerformance = article.tags.includes("performance");
    const isInjury = article.tags.includes("injury");
    const reason = matchedPlayers.length > 0
      ? `Because you follow ${matchedPlayers.map((player) => player.name).join(", ")}`
      : matchedTeams.length > 0
        ? `Because you follow ${matchedTeams.map((team) => team.name).join(", ")}`
        : coldStart ? "Popular across recent NBA coverage" : "A significant update from around the league";
    return {
      id: article.id,
      kind: isPerformance ? "performance" as const : isInjury ? "injury" as const : "story" as const,
      eyebrow: article.tags.join(" · "),
      title: article.title,
      body: article.summary,
      publishedAt: article.publishedAt,
      accent: isPerformance ? "blue" as const : isInjury ? "coral" as const : "gold" as const,
      teamIds: article.teamIds,
      playerIds: article.playerIds,
      reason,
      relevanceScore,
    };
  }).sort((left, right) => right.relevanceScore - left.relevanceScore || new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());

  const seenTitles = new Set<string>();
  return ranked.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
}

export function rankCatchUpCandidates(candidates: NewsCandidate[], limit = 3): CatchUpMoment[] {
  return candidates.map((candidate) => {
    const freshnessScore = Math.max(0, 12 - Math.floor(candidate.freshnessHours));
    const importanceScore = Math.min(100, candidate.matchedPlayers.length * 35 + candidate.matchedTeams.length * 25 + candidate.importanceScore * 2 + freshnessScore);
    const reason = candidate.article.tags.includes("injury")
      ? "Important availability update"
      : candidate.article.tags.includes("performance")
        ? "Standout player performance"
        : candidate.matchedPlayers.length > 0
          ? `Relevant to ${candidate.matchedPlayers[0].name}`
          : "Key development for a team you follow";
    return { id: candidate.article.id, title: candidate.article.title, detail: candidate.article.summary, reason, importanceScore, source: "news" as const };
  }).sort((left, right) => right.importanceScore - left.importanceScore).slice(0, limit);
}

export function rankGameEventCandidates(candidates: GameEventCandidate[], limit = 3): CatchUpMoment[] {
  return candidates.map(({ event, game, followedPlayerMatch, followedTeamMatch }) => {
    const importanceScore = Math.min(100, event.importanceScore + (followedPlayerMatch ? 16 : 0) + (followedTeamMatch ? 8 : 0));
    const reason = event.type === "injury"
      ? "Important availability update"
      : event.type === "milestone"
        ? "Standout player milestone"
        : followedPlayerMatch
          ? "Involves a player you follow"
          : followedTeamMatch
            ? "Key moment for a team you follow"
            : event.period >= 4 && event.scoringPlay
              ? "High-impact late-game possession"
              : "One of the game’s biggest moments";
    const scoreContext = event.homeScore !== undefined && event.awayScore !== undefined
      ? ` · ${game.away.short} ${event.awayScore}–${game.home.short} ${event.homeScore}`
      : "";
    return {
      id: event.id,
      title: event.title,
      detail: event.description,
      reason,
      importanceScore,
      source: "game-event" as const,
      context: `${event.periodLabel}${event.clock ? ` · ${event.clock}` : ""}${scoreContext}`,
    };
  }).sort((left, right) => right.importanceScore - left.importanceScore).slice(0, limit);
}

export function rankTeamCandidates(candidates: TeamCandidate[], limit = 8): TeamRecommendation[] {
  const personalized = candidates.filter((candidate) => !candidate.coldStart && (candidate.followedPlayerCount > 0 || candidate.upcomingOpponentCount > 0)).map((candidate) => ({
    team: candidate.team,
    score: Math.min(100, candidate.followedPlayerCount * 55 + candidate.upcomingOpponentCount * 18 + Math.min(15, candidate.articleMentionCount * 5)),
    reason: candidate.followedPlayerCount > 0 ? "You already follow a player on this team" : "They play one of your teams soon",
  })).sort((left, right) => right.score - left.score || left.team.name.localeCompare(right.team.name));

  const personalizedIds = new Set(personalized.map(({ team }) => team.id));
  const popularFallback = candidates.filter((candidate) => !personalizedIds.has(candidate.team.id)).map((candidate) => ({
    team: candidate.team,
    score: Math.min(100, 15 + Math.min(55, candidate.articleMentionCount * 18) + Math.min(30, candidate.nationalGameCount * 6)),
    reason: candidate.articleMentionCount > 0
      ? "Popular in current NBA coverage"
      : candidate.nationalGameCount > 0
        ? "Featured in nationally visible games"
        : "Popular discovery fallback",
  })).sort((left, right) => right.score - left.score || left.team.name.localeCompare(right.team.name));

  return [...personalized, ...popularFallback].slice(0, limit);
}

export function rankPlayerCandidates(candidates: PlayerCandidate[], limit = 8): PlayerRecommendation[] {
  const personalized = candidates.filter((candidate) => !candidate.coldStart && (candidate.playsForFollowedTeam || candidate.upcomingOpponent)).map((candidate) => ({
    player: candidate.player,
    score: Math.min(100, (candidate.playsForFollowedTeam ? 50 : 0) + (candidate.upcomingOpponent ? 25 : 0) + Math.min(20, candidate.articleMentionCount * 10)),
    reason: candidate.playsForFollowedTeam ? "Plays for a team you follow" : "Featured in an upcoming matchup",
  })).sort((left, right) => right.score - left.score || left.player.name.localeCompare(right.player.name));

  const personalizedIds = new Set(personalized.map(({ player }) => player.id));
  const popularFallback = candidates.filter((candidate) => !personalizedIds.has(candidate.player.id)).map((candidate) => ({
    player: candidate.player,
    score: Math.min(100, 15 + Math.min(65, candidate.articleMentionCount * 24) + Math.min(20, candidate.teamNationalGameCount * 5)),
    reason: candidate.articleMentionCount > 0
      ? "Trending in recent NBA updates"
      : candidate.teamNationalGameCount > 0
        ? "Playing in high-visibility matchups"
        : "Popular discovery fallback",
  })).sort((left, right) => right.score - left.score || left.player.name.localeCompare(right.player.name));

  return [...personalized, ...popularFallback].slice(0, limit);
}

export function rankGameCandidates(candidates: GameCandidate[], limit = 12): GameRecommendation[] {
  return candidates.map((candidate) => {
    const score = Math.min(100, candidate.statusScore + candidate.broadcastScore + Math.min(32, candidate.articleMentionCount * 8));
    const reason = candidate.game.status === "live"
      ? "Live now"
      : candidate.articleMentionCount > 1
        ? "Teams featured in current NBA coverage"
        : candidate.broadcastScore >= 23
          ? `Nationally televised on ${candidate.game.network}`
          : "Upcoming around the league";
    return { game: candidate.game, score, reason };
  }).sort((left, right) => right.score - left.score || left.game.date.localeCompare(right.game.date)).slice(0, limit);
}

export function rankAlertCandidates(candidates: AlertCandidate[], limit = 20): AlertCandidate[] {
  const typeOrder: Record<AlertCandidate["type"], number> = { closeGame: 7, injuryUpdate: 6, leadChange: 5, gameStarting: 4, finalScore: 3, milestone: 2, standoutPerformance: 1 };
  return [...candidates]
    .sort((left, right) => right.priority - left.priority || typeOrder[right.type] - typeOrder[left.type] || right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, limit);
}

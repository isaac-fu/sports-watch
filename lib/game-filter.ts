import { scheduledGameTimestamp } from "./game-time";

export type GameFilterScope = "all" | "following";

/** All remaining matchups on the next upcoming day, without recommendation limits. */
export function upcomingGamesForDay<T extends { date: string; status: string; startsAt?: string; time: string }>(games: readonly T[], today: string) {
  const upcoming = games.filter((game) => game.status === "scheduled" && game.date >= today);
  const firstDay = upcoming.reduce((day, game) => !day || game.date < day ? game.date : day, "");
  const tip = (game: T) => {
    const timestamp = scheduledGameTimestamp(game);
    return Number.isFinite(timestamp) ? timestamp : Infinity;
  };
  return upcoming.filter((game) => game.date === firstDay).sort((a, b) => tip(a) - tip(b));
}

type TeamMatchup = {
  homeId: string;
  awayId: string;
};

export function gameIncludesFollowedTeam(game: TeamMatchup, followedTeamIds: readonly string[]) {
  return followedTeamIds.includes(game.homeId) || followedTeamIds.includes(game.awayId);
}

export function filterGamesByTeamScope<T extends TeamMatchup>(games: readonly T[], followedTeamIds: readonly string[], scope: GameFilterScope) {
  if (scope === "all") return [...games];
  return games.filter((game) => gameIncludesFollowedTeam(game, followedTeamIds));
}

import type { Player, PlayerStat, Team, TeamStat } from "./models";
import { teamConference } from "./team-standings";

export type LeaderboardPlayer = PlayerStat & { imageUrl?: string; teamImageUrl?: string; teamShort?: string; teamColor?: string };
export type LeaderboardTeam = TeamStat & { imageUrl?: string; teamShort?: string; teamColor?: string; conference: "Western" | "Eastern" | null };
export function enrichLeaderboard(players: PlayerStat[], stats: TeamStat[], teams: Team[], catalogPlayers: Player[]) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const playerById = new Map(catalogPlayers.map((player) => [player.id, player]));
  return {
    players: players.map((stat): LeaderboardPlayer => ({
      ...stat, imageUrl: playerById.get(stat.playerId)?.imageUrl,
      teamImageUrl: teamById.get(stat.teamId)?.imageUrl, teamShort: teamById.get(stat.teamId)?.short,
      teamColor: teamById.get(stat.teamId)?.color,
    })),
    teams: stats.map((stat): LeaderboardTeam => {
      const team = teamById.get(stat.teamId);
      return { ...stat, imageUrl: team?.imageUrl, teamShort: team?.short, teamColor: team?.color, conference: team ? teamConference(team) : null };
    }),
  };
}

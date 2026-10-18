import type { Player, PlayerBio, PlayerCareerStat, PlayerGameLog, PlayerProfile, PlayerSeasonStat, PlayerStat, TeamStat } from "@/lib/models";
import { mockPlayers, mockPlayerStats, mockTeams, mockTeamStats } from "@/lib/mock-repository";
import { nbaSeasonLabel } from "@/lib/season";

export type SeasonStats = { players: PlayerStat[]; teams: TeamStat[] };

export interface StatsProvider {
  readonly name: string;
  getSeasonStats(season: number): Promise<SeasonStats>;
  getPlayerProfile(player: Player, season: number): Promise<PlayerProfile>;
}

type BdlTeam = { id: number; full_name?: string; abbreviation?: string };
type BdlPlayer = {
  id: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  height?: string;
  weight?: string;
  jersey_number?: string;
  college?: string;
  country?: string;
  draft_year?: number;
  draft_round?: number;
  draft_number?: number;
  team?: BdlTeam;
  team_id?: number;
};
type BdlPlayerResponse = { data?: BdlPlayer[] };
type BdlAverage = { player?: BdlPlayer; team?: BdlTeam; stats?: Record<string, unknown> } & Record<string, unknown>;
type BdlAveragesResponse = { data?: BdlAverage[] };
type BdlGame = {
  id: number;
  date?: string;
  home_team_id?: number;
  visitor_team_id?: number;
  home_team_score?: number;
  visitor_team_score?: number;
  home_team?: BdlTeam;
  visitor_team?: BdlTeam;
};
type BdlGameStat = {
  id: number;
  min?: string;
  fgm?: number;
  fga?: number;
  fg3m?: number;
  fg3a?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  turnover?: number;
  pts?: number;
  plus_minus?: number;
  player?: BdlPlayer;
  team?: BdlTeam;
  game?: BdlGame;
};
type BdlStatsResponse = { data?: BdlGameStat[] };

const numberFrom = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = Number(record[key]);
    if (record[key] !== null && record[key] !== undefined && Number.isFinite(value)) return value;
  }
  return 0;
};

const rounded = (value: number) => Number(value.toFixed(1));
const percent = (value: number) => rounded(value <= 1 ? value * 100 : value);
const normalizedName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function averageToSeason(player: Player, season: number, average: BdlAverage): PlayerSeasonStat {
  const stats = (average.stats && typeof average.stats === "object" ? average.stats : average) as Record<string, unknown>;
  return {
    playerId: player.id,
    playerName: player.name,
    teamId: player.teamId,
    teamName: average.team?.full_name ?? player.teamName,
    season,
    seasonLabel: nbaSeasonLabel(season),
    gamesPlayed: numberFrom(stats, "gp", "games_played"),
    pointsPerGame: rounded(numberFrom(stats, "pts", "points")),
    reboundsPerGame: rounded(numberFrom(stats, "reb", "rebounds")),
    assistsPerGame: rounded(numberFrom(stats, "ast", "assists")),
    stealsPerGame: rounded(numberFrom(stats, "stl", "steals")),
    blocksPerGame: rounded(numberFrom(stats, "blk", "blocks")),
    turnoversPerGame: rounded(numberFrom(stats, "tov", "turnover", "turnovers")),
    fieldGoalPercentage: percent(numberFrom(stats, "fg_pct", "field_goal_percentage")),
    threePointPercentage: percent(numberFrom(stats, "fg3_pct", "three_point_percentage")),
  };
}

function careerFromSeasons(seasons: PlayerSeasonStat[]): PlayerCareerStat | null {
  const played = seasons.filter((season) => season.gamesPlayed > 0);
  const gamesPlayed = played.reduce((total, season) => total + season.gamesPlayed, 0);
  if (gamesPlayed === 0) return null;
  const weighted = (key: keyof Pick<PlayerSeasonStat, "pointsPerGame" | "reboundsPerGame" | "assistsPerGame" | "stealsPerGame" | "blocksPerGame" | "turnoversPerGame" | "fieldGoalPercentage" | "threePointPercentage">) => rounded(played.reduce((total, season) => total + season[key] * season.gamesPlayed, 0) / gamesPlayed);
  const latest = played[0];
  return {
    playerId: latest.playerId,
    playerName: latest.playerName,
    gamesPlayed,
    seasonsPlayed: played.length,
    pointsPerGame: weighted("pointsPerGame"),
    reboundsPerGame: weighted("reboundsPerGame"),
    assistsPerGame: weighted("assistsPerGame"),
    stealsPerGame: weighted("stealsPerGame"),
    blocksPerGame: weighted("blocksPerGame"),
    turnoversPerGame: weighted("turnoversPerGame"),
    fieldGoalPercentage: weighted("fieldGoalPercentage"),
    threePointPercentage: weighted("threePointPercentage"),
  };
}

function mockPlayerProfile(player: Player, season: number): PlayerProfile {
  const index = Math.max(0, mockPlayers.findIndex((item) => item.id === player.id));
  const draftYears: Record<string, number> = { "stephen-curry": 2009, "jonathan-kuminga": 2021, "draymond-green": 2012, "jalen-brunson": 2018, "shai-gilgeous-alexander": 2018, "lebron-james": 2003, "jayson-tatum": 2017, "kevin-durant": 2007, "nikola-jokic": 2014, "luka-doncic": 2018, "bam-adebayo": 2017, "domantas-sabonis": 2016 };
  const bioByPlayer: Record<string, PlayerBio> = {
    "stephen-curry": { height: "6-2", weight: "185", jerseyNumber: "30", college: "Davidson", country: "USA", draftYear: 2009, draftRound: 1, draftNumber: 7 },
    "lebron-james": { height: "6-9", weight: "250", jerseyNumber: "23", college: "St. Vincent–St. Mary HS", country: "USA", draftYear: 2003, draftRound: 1, draftNumber: 1 },
    "nikola-jokic": { height: "6-11", weight: "284", jerseyNumber: "15", country: "Serbia", draftYear: 2014, draftRound: 2, draftNumber: 41 },
  };
  const current = mockPlayerStats.find((stat) => stat.playerId === player.id);
  const points = current?.pointsPerGame ?? rounded(18.6 + (index * 1.37) % 11);
  const rebounds = current?.reboundsPerGame ?? rounded(3.8 + (index * 1.13) % 7);
  const assists = current?.assistsPerGame ?? rounded(2.9 + (index * 1.41) % 6);
  const fieldGoal = current?.fieldGoalPercentage ?? rounded(44.2 + (index * 1.17) % 8);
  const threePoint = current?.threePointPercentage ?? rounded(33.8 + (index * .91) % 8);
  const firstSeason = draftYears[player.id] ?? Math.max(1996, season - 5);
  const seasons = Array.from({ length: season - firstSeason + 1 }, (_, offset) => {
    const year = season - offset;
    const isCurrentSeason = year === season;
    const ageFactor = Math.max(-4, Math.min(2, (year - firstSeason) * .35 - 1.2));
    return {
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      teamName: player.teamName,
      season: year,
      seasonLabel: nbaSeasonLabel(year),
      gamesPlayed: isCurrentSeason ? current?.gamesPlayed ?? 12 : 62 + ((index + year) % 18),
      pointsPerGame: isCurrentSeason ? points : rounded(Math.max(7, points + ageFactor - offset * .08)),
      reboundsPerGame: isCurrentSeason ? rebounds : rounded(Math.max(2, rebounds + ageFactor * .18)),
      assistsPerGame: isCurrentSeason ? assists : rounded(Math.max(1, assists + ageFactor * .16)),
      stealsPerGame: rounded(.7 + (index % 6) * .12),
      blocksPerGame: rounded(.2 + (index % 5) * .15),
      turnoversPerGame: rounded(1.5 + (index % 5) * .28),
      fieldGoalPercentage: rounded(fieldGoal - Math.max(0, offset - 8) * .15),
      threePointPercentage: rounded(threePoint - Math.max(0, offset - 8) * .12),
    } satisfies PlayerSeasonStat;
  });
  const opponents = mockTeams.filter((team) => team.id !== player.teamId);
  const lastTenGames = Array.from({ length: 10 }, (_, gameIndex) => {
    const opponent = opponents[(index + gameIndex) % opponents.length];
    const date = new Date();
    date.setDate(date.getDate() - gameIndex * 2 - 1);
    const won = (index + gameIndex) % 3 !== 0;
    const playerScore = won ? 116 + gameIndex % 8 : 104 + gameIndex % 6;
    const opponentScore = won ? playerScore - 4 - gameIndex % 9 : playerScore + 3 + gameIndex % 8;
    const gamePoints = Math.max(4, Math.round(points + ((gameIndex * 7 + index) % 15) - 7));
    return {
      id: `mock-${player.id}-${gameIndex}`,
      gameId: `mock-profile-game-${player.id}-${gameIndex}`,
      date: date.toISOString().slice(0, 10),
      opponentName: opponent.name,
      opponentShort: opponent.short,
      homeAway: gameIndex % 2 === 0 ? "home" : "away",
      result: won ? "W" : "L",
      score: `${playerScore}-${opponentScore}`,
      minutes: String(30 + (gameIndex * 3) % 9),
      points: gamePoints,
      rebounds: Math.max(1, Math.round(rebounds + gameIndex % 5 - 2)),
      assists: Math.max(0, Math.round(assists + (gameIndex * 2) % 5 - 2)),
      steals: gameIndex % 3,
      blocks: (gameIndex + index) % 2,
      turnovers: 1 + (gameIndex + index) % 4,
      fieldGoals: `${Math.round(gamePoints * .36)}-${Math.max(8, Math.round(gamePoints * .78))}`,
      threePointers: `${gameIndex % 5}-${3 + gameIndex % 8}`,
      plusMinus: won ? 3 + gameIndex % 12 : -(2 + gameIndex % 9),
    } satisfies PlayerGameLog;
  });
  return {
    player,
    bio: bioByPlayer[player.id] ?? { jerseyNumber: String(1 + index * 3), country: "USA", draftYear: firstSeason, draftRound: 1 },
    currentSeason: seasons[0] ?? null,
    career: careerFromSeasons(seasons),
    seasons,
    lastTenGames,
    source: "mock-repository",
    updatedAt: new Date().toISOString(),
  };
}

export class BallDontLieStatsProvider implements StatsProvider {
  readonly name = "balldontlie";

  constructor(private readonly apiKey: string, private readonly baseUrl = "https://api.balldontlie.io/v1") {}

  private async request<T>(path: string) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { headers: { Authorization: this.apiKey }, cache: "no-store" });
    if (!response.ok) throw new Error(`BALLDONTLIE request failed with ${response.status}`);
    return response.json() as Promise<T>;
  }

  private async resolvePlayer(player: Player) {
    const params = new URLSearchParams({ search: player.name, per_page: "25" });
    const payload = await this.request<BdlPlayerResponse>(`/players?${params}`);
    return payload.data?.find((candidate) => normalizedName(`${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`.trim()) === normalizedName(player.name)) ?? null;
  }

  private async getAverage(player: Player, providerId: number, season: number) {
    const params = new URLSearchParams({ season: String(season), season_type: "regular", type: "base" });
    params.append("player_ids[]", String(providerId));
    const payload = await this.request<BdlAveragesResponse>(`/season_averages/general?${params}`);
    const average = payload.data?.[0];
    return average ? averageToSeason(player, season, average) : null;
  }

  async getSeasonStats(season: number) {
    const resolved = await Promise.all(mockPlayers.map(async (appPlayer) => {
      const player = await this.resolvePlayer(appPlayer);
      return player ? { appPlayer, providerId: player.id } : null;
    }));
    const matched = resolved.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (matched.length === 0) throw new Error("BALLDONTLIE did not resolve any configured players.");
    const players = (await Promise.all(matched.map(({ appPlayer, providerId }) => this.getAverage(appPlayer, providerId, season)))).filter((stat): stat is PlayerSeasonStat => stat !== null);
    if (players.length === 0) throw new Error("BALLDONTLIE returned no season averages for configured players.");
    return { players, teams: mockTeamStats };
  }

  async getPlayerProfile(player: Player, season: number): Promise<PlayerProfile> {
    const providerPlayer = await this.resolvePlayer(player);
    if (!providerPlayer) throw new Error("BALLDONTLIE could not resolve this player.");
    const firstSeason = Math.max(1996, providerPlayer.draft_year ?? season - 5);
    const seasonNumbers = Array.from({ length: season - firstSeason + 1 }, (_, index) => season - index);
    const seasons: PlayerSeasonStat[] = [];
    for (let index = 0; index < seasonNumbers.length; index += 4) {
      const batch = await Promise.all(seasonNumbers.slice(index, index + 4).map((year) => this.getAverage(player, providerPlayer.id, year).catch(() => null)));
      seasons.push(...batch.filter((stat): stat is PlayerSeasonStat => stat !== null));
    }
    if (seasons.length === 0) throw new Error("BALLDONTLIE returned no career season averages for this player.");

    let lastTenGames: PlayerGameLog[] = [];
    try {
      const params = new URLSearchParams({ per_page: "100", season_type: "regular" });
      params.append("player_ids[]", String(providerPlayer.id));
      params.append("seasons[]", String(season));
      const payload = await this.request<BdlStatsResponse>(`/stats?${params}`);
      const teamId = providerPlayer.team?.id ?? providerPlayer.team_id;
      lastTenGames = (payload.data ?? []).filter((stat) => stat.game).sort((left, right) => (right.game?.date ?? "").localeCompare(left.game?.date ?? "")).slice(0, 10).map((stat) => {
        const game = stat.game!;
        const isHome = teamId === game.home_team_id;
        const opponent = isHome ? game.visitor_team : game.home_team;
        const teamScore = isHome ? game.home_team_score ?? 0 : game.visitor_team_score ?? 0;
        const opponentScore = isHome ? game.visitor_team_score ?? 0 : game.home_team_score ?? 0;
        return {
          id: `bdl-stat-${stat.id}`,
          gameId: `bdl-${game.id}`,
          date: game.date?.slice(0, 10) ?? "",
          opponentName: opponent?.full_name ?? "Opponent",
          opponentShort: opponent?.abbreviation ?? "OPP",
          homeAway: isHome ? "home" : "away",
          result: teamScore >= opponentScore ? "W" : "L",
          score: `${teamScore}-${opponentScore}`,
          minutes: stat.min ?? "—",
          points: stat.pts ?? 0,
          rebounds: stat.reb ?? 0,
          assists: stat.ast ?? 0,
          steals: stat.stl ?? 0,
          blocks: stat.blk ?? 0,
          turnovers: stat.turnover ?? 0,
          fieldGoals: `${stat.fgm ?? 0}-${stat.fga ?? 0}`,
          threePointers: `${stat.fg3m ?? 0}-${stat.fg3a ?? 0}`,
          plusMinus: stat.plus_minus ?? 0,
        };
      });
    } catch { /* A lower provider tier can still return bio and season averages. */ }

    return {
      player: { ...player, position: providerPlayer.position || player.position, teamName: providerPlayer.team?.full_name ?? player.teamName },
      bio: { height: providerPlayer.height, weight: providerPlayer.weight, jerseyNumber: providerPlayer.jersey_number, college: providerPlayer.college, country: providerPlayer.country, draftYear: providerPlayer.draft_year, draftRound: providerPlayer.draft_round, draftNumber: providerPlayer.draft_number },
      currentSeason: seasons.find((item) => item.season === season) ?? null,
      career: careerFromSeasons(seasons),
      seasons,
      lastTenGames,
      source: this.name,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const mockStatsProvider: StatsProvider = {
  name: "mock-repository",
  async getSeasonStats() { return { players: mockPlayerStats, teams: mockTeamStats }; },
  async getPlayerProfile(player, season) { return mockPlayerProfile(player, season); },
};

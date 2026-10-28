import type { Player, PlayerBio, PlayerCareerStat, PlayerGameLog, PlayerProfile, PlayerSeasonStat, PlayerStat, Team, TeamStat } from "@/lib/models";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import { mockPlayerStats, mockTeamStats } from "@/lib/mock-repository";
import { nbaSeasonLabel } from "@/lib/season";
import type { Game } from "@/lib/models";
import type { GameBoxScore } from "@/lib/box-score";

export type SeasonStats = { players: PlayerStat[]; teams: TeamStat[] };
export type TeamStandingsSnapshot = { season: number; teams: TeamStat[] };

export interface StatsProvider {
  readonly name: string;
  getBoxScore?(game: Game): Promise<GameBoxScore>;
  getSeasonStats(season: number): Promise<SeasonStats>;
  getPlayerProfile(player: Player, season: number): Promise<PlayerProfile>;
  getTeamStats(team: Team, season: number): Promise<TeamStat | null>;
  getTeamStandings(season: number): Promise<TeamStandingsSnapshot>;
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
type BdlSinglePlayerResponse = { data?: BdlPlayer };
type BdlAverage = { player?: BdlPlayer; team?: BdlTeam; stats?: Record<string, unknown> } & Record<string, unknown>;
type BdlMeta = { next_cursor?: number | string | null };
type BdlAveragesResponse = { data?: BdlAverage[]; meta?: BdlMeta };
type BdlGame = {
  id: number;
  date?: string;
  season?: number;
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
  ftm?: number;
  fta?: number;
  pf?: number;
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
type BdlStanding = { team: BdlTeam; conference_rank?: number; wins?: number; losses?: number };
type BdlStandingsResponse = { data?: BdlStanding[]; meta?: BdlMeta };

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
    ...(stats.ft_pct !== undefined && stats.ft_pct !== null ? { freeThrowPercentage: percent(numberFrom(stats, "ft_pct")) } : {}),
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

const chunksOf = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

function providerId(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function mockPlayerProfile(player: Player, season: number): PlayerProfile {
  const index = Math.max(0, canonicalPlayers.findIndex((item) => item.id === player.id));
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
  const opponents = canonicalTeams.filter((team) => team.id !== player.teamId);
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
      season,
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

  async getBoxScore(game: Game): Promise<GameBoxScore> {
    const id = /^bdl-(\d+)$/.exec(game.id)?.[1];
    if (!id) throw new Error("Unsupported game identity for BALLDONTLIE stats.");
    const params = new URLSearchParams({ per_page: "100" });
    params.append("game_ids[]", id);
    const rows = await this.requestAll<BdlGameStat>("/stats", params);
    const shooting = (made?: number, attempted?: number) => made == null || attempted == null ? null : `${made}-${attempted}`;
    const teams = [game.away, game.home].map((team) => ({
      teamId: team.id,
      name: team.name,
      totals: null,
      players: rows.filter((row) => row.team && this.canonicalTeam(row.team)?.id === team.id).map((row) => ({
        playerId: canonicalPlayers.find((player) => player.providerIds?.balldontlie === String(row.player?.id))?.id,
        name: `${row.player?.first_name ?? ""} ${row.player?.last_name ?? ""}`.trim(),
        minutes: row.min ?? null, points: row.pts ?? null, rebounds: row.reb ?? null, assists: row.ast ?? null,
        steals: row.stl ?? null, blocks: row.blk ?? null, turnovers: row.turnover ?? null, fouls: row.pf ?? null,
        fieldGoals: shooting(row.fgm, row.fga), threePointers: shooting(row.fg3m, row.fg3a), freeThrows: shooting(row.ftm, row.fta), freeThrowsMade: row.ftm ?? null, plusMinus: row.plus_minus ?? null,
      })),
    }));
    return { gameId: game.id, source: this.name, status: teams.every((team) => team.players.length) ? "available" : "unavailable", teams, updatedAt: new Date().toISOString() };
  }

  private async request<T>(path: string) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { headers: { Authorization: this.apiKey }, cache: "no-store" });
    if (!response.ok) throw new Error(`BALLDONTLIE request failed with ${response.status}`);
    return response.json() as Promise<T>;
  }

  private async requestAll<T>(path: string, baseParams: URLSearchParams) {
    const items: T[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams(baseParams);
      if (cursor) params.set("cursor", cursor);
      const payload = await this.request<{ data?: T[]; meta?: BdlMeta }>(`${path}?${params}`);
      items.push(...(payload.data ?? []));
      const nextCursor = payload.meta?.next_cursor;
      cursor = nextCursor === undefined || nextCursor === null ? null : String(nextCursor);
      if (cursor && seenCursors.has(cursor)) throw new Error(`BALLDONTLIE ${path} returned a repeated cursor.`);
      if (cursor) seenCursors.add(cursor);
      if (seenCursors.size > 20) throw new Error(`BALLDONTLIE ${path} exceeded the page limit.`);
    } while (cursor);
    return items;
  }

  private async resolvePlayer(player: Player) {
    const knownId = providerId(player.providerIds?.balldontlie);
    if (knownId !== null) {
      try {
        const payload = await this.request<BdlSinglePlayerResponse>(`/players/${knownId}`);
        if (payload.data) return payload.data;
      } catch { /* fall through to name resolution for stale provider ids */ }
    }
    const params = new URLSearchParams({ search: player.name, per_page: "25" });
    const payload = await this.request<BdlPlayerResponse>(`/players?${params}`);
    return payload.data?.find((candidate) => normalizedName(`${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`.trim()) === normalizedName(player.name)) ?? null;
  }

  private async resolvePlayerId(player: Player) {
    const knownId = providerId(player.providerIds?.balldontlie);
    if (knownId !== null) return knownId;
    return (await this.resolvePlayer(player))?.id ?? null;
  }

  private async getAverage(player: Player, providerId: number, season: number) {
    const params = new URLSearchParams({ season: String(season), season_type: "regular", type: "base" });
    params.append("player_ids[]", String(providerId));
    const payload = await this.request<BdlAveragesResponse>(`/season_averages/general?${params}`);
    const average = payload.data?.[0];
    return average ? averageToSeason(player, season, average) : null;
  }

  private async getPlayerSeasonStats(season: number) {
    const resolved = await Promise.all(canonicalPlayers.map(async (appPlayer) => {
      const id = await this.resolvePlayerId(appPlayer);
      return id === null ? null : { appPlayer, providerId: id };
    }));
    const matched = resolved.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const playerByProviderId = new Map(matched.map((entry) => [entry.providerId, entry.appPlayer]));
    const stats: PlayerSeasonStat[] = [];
    for (const batch of chunksOf(matched, 75)) {
      const params = new URLSearchParams({ season: String(season), season_type: "regular", type: "base", per_page: "100" });
      batch.forEach((entry) => params.append("player_ids[]", String(entry.providerId)));
      const averages = await this.requestAll<BdlAverage>("/season_averages/general", params);
      for (const average of averages) {
        const id = average.player?.id;
        const appPlayer = id === undefined ? (batch.length === 1 ? batch[0].appPlayer : null) : playerByProviderId.get(id);
        if (appPlayer) stats.push(averageToSeason(appPlayer, season, average));
      }
    }
    return stats;
  }

  private canonicalTeam(team: BdlTeam) {
    return canonicalTeams.find((candidate) => candidate.providerIds?.balldontlie === String(team.id))
      ?? canonicalTeams.find((candidate) => candidate.short === team.abbreviation)
      ?? null;
  }

  private async resolveTeamId(team: Team) {
    const knownId = providerId(team.providerIds?.balldontlie);
    if (knownId !== null) return knownId;
    const payload = await this.request<{ data?: BdlTeam[] }>("/teams");
    return payload.data?.find((candidate) => candidate.abbreviation === team.short)?.id ?? null;
  }

  private async getTeamSeasonStats(season: number, onlyTeamIds: number[] = []) {
    const paramsFor = (type: string) => {
      const params = new URLSearchParams({ season: String(season), season_type: "regular", type, per_page: "100" });
      onlyTeamIds.forEach((id) => params.append("team_ids[]", String(id)));
      return params;
    };
    const [baseRows, opponentRows, standingsPayload] = await Promise.all([
      this.requestAll<BdlAverage>("/team_season_averages/general", paramsFor("base")),
      this.requestAll<BdlAverage>("/team_season_averages/general", paramsFor("opponent")),
      this.request<BdlStandingsResponse>(`/standings?${new URLSearchParams({ season: String(season) })}`),
    ]);
    const opponentByTeamId = new Map(opponentRows.flatMap((row) => row.team ? [[row.team.id, row]] : []));
    const standingByTeamId = new Map((standingsPayload.data ?? []).map((standing) => [standing.team.id, standing]));
    return baseRows.flatMap((base): TeamStat[] => {
      if (!base.team) return [];
      const appTeam = this.canonicalTeam(base.team);
      const opponent = opponentByTeamId.get(base.team.id);
      const standing = standingByTeamId.get(base.team.id);
      if (!appTeam || !opponent || !standing) return [];
      const baseStats = (base.stats && typeof base.stats === "object" ? base.stats : base) as Record<string, unknown>;
      const opponentStats = (opponent.stats && typeof opponent.stats === "object" ? opponent.stats : opponent) as Record<string, unknown>;
      return [{
        teamId: appTeam.id,
        teamName: base.team.full_name ?? appTeam.name,
        season,
        wins: standing.wins ?? numberFrom(baseStats, "w", "wins"),
        losses: standing.losses ?? numberFrom(baseStats, "l", "losses"),
        conferenceRank: standing.conference_rank ?? 0,
        pointsPerGame: rounded(numberFrom(baseStats, "pts", "points")),
        pointsAllowedPerGame: rounded(numberFrom(opponentStats, "pts", "opp_pts", "points")),
      }];
    });
  }

  private seasonForGame(game: BdlGame) {
    if (game.season !== undefined) return game.season;
    const date = game.date ? new Date(`${game.date.slice(0, 10)}T12:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime())) return 0;
    return date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  }

  private async getLastTenGames(providerPlayer: BdlPlayer, season: number): Promise<PlayerGameLog[]> {
    const params = new URLSearchParams({ per_page: "100", season_type: "regular" });
    params.append("player_ids[]", String(providerPlayer.id));
    params.append("seasons[]", String(season));
    params.append("seasons[]", String(season - 1));
    const rows = await this.requestAll<BdlGameStat>("/stats", params);
    return rows.filter((stat) => stat.game).sort((left, right) => (right.game?.date ?? "").localeCompare(left.game?.date ?? "")).slice(0, 10).map((stat) => {
      const game = stat.game!;
      const playerTeamId = stat.team?.id ?? providerPlayer.team?.id ?? providerPlayer.team_id;
      const isHome = playerTeamId === game.home_team_id;
      const opponentProviderId = isHome ? game.visitor_team_id : game.home_team_id;
      const nestedOpponent = isHome ? game.visitor_team : game.home_team;
      const canonicalOpponent = canonicalTeams.find((team) => team.providerIds?.balldontlie === String(opponentProviderId));
      const teamScore = isHome ? game.home_team_score ?? 0 : game.visitor_team_score ?? 0;
      const opponentScore = isHome ? game.visitor_team_score ?? 0 : game.home_team_score ?? 0;
      return {
        id: `bdl-stat-${stat.id}`,
        gameId: `bdl-${game.id}`,
        date: game.date?.slice(0, 10) ?? "",
        season: this.seasonForGame(game),
        opponentName: nestedOpponent?.full_name ?? canonicalOpponent?.name ?? "Opponent",
        opponentShort: nestedOpponent?.abbreviation ?? canonicalOpponent?.short ?? "OPP",
        homeAway: isHome ? "home" : "away",
        result: teamScore > opponentScore ? "W" : "L",
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
        ...(stat.ftm !== undefined && stat.fta !== undefined ? { freeThrows: `${stat.ftm}-${stat.fta}` } : {}),
        plusMinus: stat.plus_minus ?? 0,
      };
    });
  }

  async getSeasonStats(season: number) {
    const [players, teams] = await Promise.all([this.getPlayerSeasonStats(season), this.getTeamSeasonStats(season)]);
    if (players.length === 0 && teams.length === 0) throw new Error("BALLDONTLIE returned no season statistics.");
    return { players, teams };
  }

  async getTeamStats(team: Team, season: number) {
    const id = await this.resolveTeamId(team);
    if (id === null) return null;
    const current = await this.getTeamSeasonStats(season, [id]);
    if (current[0]) return current[0];
    return (await this.getTeamSeasonStats(season - 1, [id]))[0] ?? null;
  }

  async getTeamStandings(season: number) {
    const current = await this.getTeamSeasonStats(season);
    if (current.some((stat) => stat.wins + stat.losses > 0)) return { season, teams: current };
    return { season: season - 1, teams: await this.getTeamSeasonStats(season - 1) };
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
    try { lastTenGames = await this.getLastTenGames(providerPlayer, season); } catch { /* ALL-STAR+ game stats are optional. */ }

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
  async getTeamStats(team, season) {
    const stat = mockTeamStats.find((item) => item.teamId === team.id);
    return stat ? { ...stat, season } : null;
  },
  async getTeamStandings(season) {
    const teams = canonicalTeams.map((team, index) => {
      const existing = mockTeamStats.find((stat) => stat.teamId === team.id);
      if (existing) return { ...existing, season };
      const [recordWins = 24 + index, recordLosses = 18 + (index % 9)] = team.record.split(/[–-]/).map(Number);
      return {
        teamId: team.id,
        teamName: team.name,
        season,
        wins: Number.isFinite(recordWins) ? recordWins : 24 + index,
        losses: Number.isFinite(recordLosses) ? recordLosses : 18 + (index % 9),
        conferenceRank: 1 + (index % 15),
        pointsPerGame: rounded(108.5 + (index * 1.37) % 12),
        pointsAllowedPerGame: rounded(107.8 + (index * 1.11) % 12),
      };
    });
    return { season, teams };
  },
};

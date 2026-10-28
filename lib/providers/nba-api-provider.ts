import type { ProviderCatalog } from "@/lib/catalog";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import type { Game, GameEvent, Player, PlayerProfile, Team, TeamStat } from "@/lib/models";
import type { GameBoxScore } from "@/lib/box-score";
import { currentNbaSeasonStart } from "@/lib/season";
import type { CatalogProvider, GameFilters } from "./types";
import type { SeasonStats, StatsProvider, TeamStandingsSnapshot } from "./stats-provider";

type NbaApiOptions = {
  baseUrl?: string;
  timeoutMs?: number;
};

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value! > 0 ? Math.floor(value!) : fallback;
}

export class NbaApiProvider implements CatalogProvider, StatsProvider {
  readonly name = "nba_api";
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: NbaApiOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:8001").replace(/\/$/, "");
    this.timeoutMs = positiveInteger(options.timeoutMs, 120_000);
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`nba_api request failed with ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`);
    }
    return response.json() as Promise<T>;
  }

  async getCatalogIdentities(): Promise<ProviderCatalog> {
    const catalog = await this.request<ProviderCatalog>("/v1/catalog", { season: currentNbaSeasonStart() });
    if (!Array.isArray(catalog.teams) || !Array.isArray(catalog.players)) throw new Error("nba_api returned an invalid catalog.");
    return catalog;
  }

  async getSeasonStats(season: number): Promise<SeasonStats> {
    const stats = await this.request<SeasonStats>("/v1/season-stats", {
      season,
      teams: canonicalTeams,
      players: canonicalPlayers,
    });
    if (!Array.isArray(stats.players) || !Array.isArray(stats.teams)) throw new Error("nba_api returned invalid season statistics.");
    if (stats.players.length === 0 && stats.teams.length === 0) throw new Error(`nba_api returned no statistics for ${season}.`);
    return stats;
  }

  async getPlayerProfile(player: Player, season: number): Promise<PlayerProfile> {
    const profile = await this.request<PlayerProfile>("/v1/player-profile", {
      season,
      player,
      teams: canonicalTeams,
    });
    if (!profile?.player || !Array.isArray(profile.seasons) || !Array.isArray(profile.lastTenGames)) {
      throw new Error("nba_api returned an invalid player profile.");
    }
    return profile;
  }

  async getTeamStats(team: Team, season: number): Promise<TeamStat | null> {
    return this.request<TeamStat | null>("/v1/team-stats", { season, team });
  }

  async getTeamGames(team: Team, from: string, to: string): Promise<Game[]> {
    const games = await this.request<Game[]>("/v1/team-games", {
      teamId: team.id, from, to, teams: canonicalTeams,
    });
    if (!Array.isArray(games) || games.some((game) => !/^nba-\d{10}$/.test(game.id)
      || !game.home || !game.away || (game.home.id !== team.id && game.away.id !== team.id))) {
      throw new Error("nba_api returned invalid team games.");
    }
    return games;
  }

  async getGames(filters: GameFilters = {}): Promise<Game[]> {
    const from = filters.from ?? new Date().toISOString().slice(0, 10);
    const to = filters.to ?? new Date(Date.parse(`${from}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
    if (filters.teamId) {
      const team = canonicalTeams.find((team) => team.id === filters.teamId);
      if (!team) throw new Error("NBA schedule requests require a canonical team.");
      return this.getTeamGames(team, from, to);
    }
    const games = await this.request<Game[]>("/v1/games", { from, to, teams: canonicalTeams });
    if (!Array.isArray(games) || games.some((game) => !/^nba-\d{10}$/.test(game.id) || !game.home || !game.away)) {
      throw new Error("nba_api returned invalid games.");
    }
    return games;
  }

  async getGame(gameId: string): Promise<Game | null> {
    if (!/^nba-\d{10}$/.test(gameId)) return null;
    const game = await this.request<Game | null>("/v1/game", { gameId, teams: canonicalTeams });
    if (game && (game.id !== gameId || !game.home || !game.away)) throw new Error("nba_api returned an invalid game.");
    return game;
  }

  async getGameEvents(_gameId: string): Promise<GameEvent[]> {
    throw new Error("NBA play-by-play is not available from the schedule service.");
  }

  async getTeamStandings(season: number): Promise<TeamStandingsSnapshot> {
    const standings = await this.request<TeamStandingsSnapshot>("/v1/team-standings", { season, teams: canonicalTeams });
    if (!Number.isInteger(standings.season) || !Array.isArray(standings.teams)) throw new Error("nba_api returned invalid team standings.");
    return standings;
  }

  async getBoxScore(game: Game): Promise<GameBoxScore> {
    const box = await this.request<GameBoxScore>("/v1/box-score", { game, players: canonicalPlayers });
    if (box.gameId !== game.id || !Array.isArray(box.teams)) throw new Error("nba_api returned an invalid box score.");
    return box;
  }
}

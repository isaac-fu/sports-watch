import type { ProviderCatalog } from "@/lib/catalog";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import type { Player, PlayerProfile, Team, TeamStat } from "@/lib/models";
import { currentNbaSeasonStart } from "@/lib/season";
import type { CatalogProvider } from "./types";
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

  async getTeamStandings(season: number): Promise<TeamStandingsSnapshot> {
    const standings = await this.request<TeamStandingsSnapshot>("/v1/team-standings", { season, teams: canonicalTeams });
    if (!Number.isInteger(standings.season) || !Array.isArray(standings.teams)) throw new Error("nba_api returned invalid team standings.");
    return standings;
  }
}

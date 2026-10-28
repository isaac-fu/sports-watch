import { canonicalTeams, findTeamByProviderId, mergeProviderId, type ProviderCatalog } from "@/lib/catalog";
import type { Game, GameEvent, GameEventType, Team } from "@/lib/models";
import { formatPacificTipTime, pacificDateKey } from "@/lib/game-time";
import type { CatalogProvider, GameFilters, NbaProvider } from "./types";
import { fetchSportsProvider } from "@/lib/provider-backoff";

type BdlTeam = { id: number; abbreviation: string; full_name?: string; name?: string; city?: string };
type BdlPlayer = { id: number; first_name: string; last_name: string; position?: string; team: BdlTeam };
type BdlGame = {
  id: number;
  date: string;
  datetime?: string;
  time?: string;
  status?: string;
  status_state?: string;
  venue?: string;
  home_team_score?: number;
  visitor_team_score?: number;
  period?: number;
  home_team: BdlTeam;
  visitor_team: BdlTeam;
};

type BdlPlay = {
  game_id: number;
  order: number;
  type?: string;
  text?: string;
  home_score?: number;
  away_score?: number;
  period?: number;
  period_display?: string;
  clock?: string;
  scoring_play?: boolean;
  shooting_play?: boolean;
  score_value?: number | null;
  team?: BdlTeam | null;
  wallclock?: string;
  participants?: number[];
};

type BdlResponse<T> = { data: T[]; meta?: { next_cursor?: number | string | null } };
type BdlSingleResponse<T> = { data: T };

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDaysKey = (amount: number) => { const date = new Date(); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };

function mapTeam(team: BdlTeam): Team {
  const providerId = String(team.id);
  const knownTeam = findTeamByProviderId("balldontlie", providerId) ?? canonicalTeams.find((candidate) => candidate.short === team.abbreviation);
  if (knownTeam) return mergeProviderId(knownTeam, "balldontlie", providerId);
  return { id: `bdl-${team.id}`, name: team.full_name ?? `${team.city ?? ""} ${team.name ?? team.abbreviation}`.trim(), short: team.abbreviation, color: "#777b75", record: "—", providerIds: { balldontlie: providerId } };
}

function mapStatus(game: BdlGame): Game["status"] {
  const status = game.status?.trim() ?? "";
  if (game.status_state === "final" || /^final\b/i.test(status)) return "final";
  if (game.status_state === "in_progress") return "live";
  // Older responses expose quarter/halftime labels without status_state.
  if ((!game.status_state || game.status_state === "unknown") && /(?:\bqtr\b|\bquarter\b|\bhalftime\b|\bot\b|\bovertime\b)/i.test(status)) return "live";
  return "scheduled";
}

function mapGame(game: BdlGame): Game {
  const start = game.datetime ? new Date(game.datetime) : null;
  const startsAt = start && !Number.isNaN(start.getTime()) ? start.toISOString() : undefined;
  const date = pacificDateKey(startsAt, game.date);
  const providerTime = game.time && !["Final", "TBD"].includes(game.time) ? game.time : "TBD";
  const time = formatPacificTipTime(startsAt, providerTime);
  return { id: `bdl-${game.id}`, date, time, startsAt, network: "NBA", venue: game.venue ?? "NBA arena", status: mapStatus(game), homeScore: game.home_team_score, awayScore: game.visitor_team_score, period: game.period, clock: mapStatus(game) === "live" ? game.time?.trim() || game.status : undefined, updatedAt: new Date().toISOString(), home: mapTeam(game.home_team), away: mapTeam(game.visitor_team) };
}

function classifyPlay(play: BdlPlay): GameEventType {
  const description = `${play.type ?? ""} ${play.text ?? ""}`.toLowerCase();
  if (/injur|locker room|questionable to return/.test(description)) return "injury";
  if (/career|record|milestone/.test(description)) return "milestone";
  if (description.includes("turnover")) return "turnover";
  if (description.includes("timeout")) return "timeout";
  if (description.includes("foul")) return "foul";
  if (/end of|start of|quarter begins|period/.test(description)) return "period";
  if (play.scoring_play) return "score";
  return "play";
}

function playTitle(play: BdlPlay, type: GameEventType) {
  if (type === "score") return play.score_value === 3 ? "Three-pointer" : "Made basket";
  if (type === "turnover") return "Turnover";
  if (type === "timeout") return "Timeout";
  if (type === "foul") return "Foul";
  if (type === "injury") return "Injury update";
  if (type === "milestone") return "Milestone";
  if (type === "period") return play.period_display ?? "Period update";
  return play.type ?? "Game update";
}

function mapPlay(play: BdlPlay, gameId: string): GameEvent {
  const type = classifyPlay(play);
  return {
    id: `${gameId}-event-${play.order}`,
    gameId,
    sequence: play.order,
    period: play.period ?? 0,
    periodLabel: play.period_display ?? (play.period ? (play.period <= 4 ? `Q${play.period}` : `OT${play.period - 4}`) : "Game"),
    clock: play.clock ?? "",
    type,
    title: playTitle(play, type),
    description: play.text ?? play.type ?? "Game update",
    occurredAt: play.wallclock ?? new Date().toISOString(),
    teamId: play.team ? mapTeam(play.team).id : undefined,
    playerIds: (play.participants ?? []).map((id) => `bdl-player-${id}`),
    homeScore: play.home_score,
    awayScore: play.away_score,
    scoringPlay: Boolean(play.scoring_play),
    scoreValue: play.score_value ?? undefined,
    importanceScore: 0,
  };
}

function providerGameId(gameId: string) {
  const match = /^bdl-(\d+)$/.exec(gameId);
  return match ? match[1] : null;
}

export class BallDontLieProvider implements NbaProvider, CatalogProvider {
  readonly name = "balldontlie";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.balldontlie.io/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async getCollection<T>(path: string, paginated = false): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null = null;
    const seenCursors = new Set<string>();
    do {
      const params = new URLSearchParams();
      if (paginated) params.set("per_page", "100");
      if (cursor) params.set("cursor", cursor);
      const query = params.size > 0 ? `?${params.toString()}` : "";
      const response = await fetchSportsProvider(`${this.baseUrl}${path}${query}`, this.apiKey);
      if (!response.ok) throw new Error(`BALLDONTLIE ${path} request failed with ${response.status}`);
      const payload = await response.json() as BdlResponse<T>;
      items.push(...payload.data);
      const nextCursor = payload.meta?.next_cursor;
      cursor = nextCursor === undefined || nextCursor === null ? null : String(nextCursor);
      if (cursor && seenCursors.has(cursor)) throw new Error(`BALLDONTLIE ${path} returned a repeated cursor.`);
      if (cursor) seenCursors.add(cursor);
      if (seenCursors.size > 20) throw new Error(`BALLDONTLIE ${path} exceeded the catalog page limit.`);
    } while (cursor);
    return items;
  }

  async getCatalogIdentities(): Promise<ProviderCatalog> {
    const [teams, players] = await Promise.all([
      this.getCollection<BdlTeam>("/teams"),
      this.getCollection<BdlPlayer>("/players/active", true),
    ]);
    return {
      teams: teams.map((team) => ({
        providerId: String(team.id),
        name: team.full_name ?? `${team.city ?? ""} ${team.name ?? team.abbreviation}`.trim(),
        short: team.abbreviation,
      })),
      players: players.map((player) => ({
        providerId: String(player.id),
        name: `${player.first_name} ${player.last_name}`.trim(),
        position: player.position ?? "",
        teamProviderId: String(player.team.id),
      })),
    };
  }

  async getGames(filters: GameFilters = {}) {
    const params = new URLSearchParams({ start_date: filters.from ?? todayKey(), end_date: filters.to ?? addDaysKey(7), per_page: "100" });
    const team = canonicalTeams.find((candidate) => candidate.id === filters.teamId);
    if (team?.providerIds?.balldontlie) params.append("team_ids[]", team.providerIds.balldontlie);
    const games = new Map<string, Game>();
    const cursors = new Set<string>();
    for (let page = 0; page < 50; page += 1) {
      const response = await fetchSportsProvider(`${this.baseUrl}/games?${params}`, this.apiKey);
      if (!response.ok) throw new Error(`BALLDONTLIE games request failed with ${response.status}`);
      const payload = await response.json() as BdlResponse<BdlGame>;
      for (const row of payload.data) { const game = mapGame(row); games.set(game.id, game); }
      const next = payload.meta?.next_cursor;
      if (next === undefined || next === null) return Array.from(games.values()).filter((game) => !filters.teamId || game.home.id === filters.teamId || game.away.id === filters.teamId);
      const cursor = String(next);
      if (cursors.has(cursor)) throw new Error("BALLDONTLIE games returned a repeated cursor.");
      cursors.add(cursor);
      params.set("cursor", cursor);
    }
    throw new Error("BALLDONTLIE games exceeded the page limit.");
  }

  async getGame(gameId: string) {
    const id = providerGameId(gameId);
    if (!id) return null;
    const response = await fetchSportsProvider(`${this.baseUrl}/games/${id}`, this.apiKey);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`BALLDONTLIE game request failed with ${response.status}`);
    const payload = await response.json() as BdlSingleResponse<BdlGame>;
    return mapGame(payload.data);
  }

  async getGameEvents(gameId: string) {
    const id = providerGameId(gameId);
    if (!id) return [];
    const params = new URLSearchParams({ game_id: id });
    const response = await fetchSportsProvider(`${this.baseUrl}/plays?${params.toString()}`, this.apiKey);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`BALLDONTLIE plays request failed with ${response.status}`);
    const payload = await response.json() as BdlResponse<BdlPlay>;
    return payload.data.map((play) => mapPlay(play, gameId)).sort((a, b) => a.sequence - b.sequence);
  }
}

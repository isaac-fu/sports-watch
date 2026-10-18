import { mockTeams } from "@/lib/mock-repository";
import type { Game, GameEvent, GameEventType, Team } from "@/lib/models";
import type { GameFilters, NbaProvider } from "./types";

type BdlTeam = { id: number; abbreviation: string; full_name?: string; name?: string; city?: string };
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

type BdlResponse<T> = { data: T[] };
type BdlSingleResponse<T> = { data: T };

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDaysKey = (amount: number) => { const date = new Date(); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };

function mapTeam(team: BdlTeam): Team {
  const knownTeam = mockTeams.find((candidate) => candidate.short === team.abbreviation);
  if (knownTeam) return knownTeam;
  return { id: `bdl-${team.id}`, name: team.full_name ?? `${team.city ?? ""} ${team.name ?? team.abbreviation}`.trim(), short: team.abbreviation, color: "#777b75", record: "—" };
}

function mapStatus(game: BdlGame): Game["status"] {
  if (game.status_state === "in_progress") return "live";
  if (game.status_state === "final" || game.status?.toLowerCase() === "final") return "final";
  return "scheduled";
}

function mapGame(game: BdlGame): Game {
  const start = game.datetime ? new Date(game.datetime) : null;
  const date = start && !Number.isNaN(start.getTime()) ? start.toISOString().slice(0, 10) : game.date;
  const time = game.time && !["Final", "TBD"].includes(game.time) ? game.time : start && !Number.isNaN(start.getTime()) ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD";
  return { id: `bdl-${game.id}`, date, time, network: "NBA", venue: game.venue ?? "NBA arena", status: mapStatus(game), homeScore: game.home_team_score, awayScore: game.visitor_team_score, period: game.period, clock: game.status_state === "in_progress" ? game.time : undefined, updatedAt: new Date().toISOString(), home: mapTeam(game.home_team), away: mapTeam(game.visitor_team) };
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

export class BallDontLieProvider implements NbaProvider {
  readonly name = "balldontlie";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.balldontlie.io/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getGames(filters: GameFilters = {}) {
    const params = new URLSearchParams({ start_date: filters.from ?? todayKey(), end_date: filters.to ?? addDaysKey(180), per_page: "100" });
    const response = await fetch(`${this.baseUrl}/games?${params.toString()}`, { headers: { Authorization: this.apiKey }, cache: "no-store" });
    if (!response.ok) throw new Error(`BALLDONTLIE games request failed with ${response.status}`);
    const payload = await response.json() as BdlResponse<BdlGame>;
    return payload.data.map(mapGame).filter((game) => !filters.teamId || game.home.id === filters.teamId || game.away.id === filters.teamId);
  }

  async getGame(gameId: string) {
    const id = providerGameId(gameId);
    if (!id) return null;
    const response = await fetch(`${this.baseUrl}/games/${id}`, { headers: { Authorization: this.apiKey }, cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`BALLDONTLIE game request failed with ${response.status}`);
    const payload = await response.json() as BdlSingleResponse<BdlGame>;
    return mapGame(payload.data);
  }

  async getGameEvents(gameId: string) {
    const id = providerGameId(gameId);
    if (!id) return [];
    const params = new URLSearchParams({ game_id: id });
    const response = await fetch(`${this.baseUrl}/plays?${params.toString()}`, { headers: { Authorization: this.apiKey }, cache: "no-store" });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`BALLDONTLIE plays request failed with ${response.status}`);
    const payload = await response.json() as BdlResponse<BdlPlay>;
    return payload.data.map((play) => mapPlay(play, gameId)).sort((a, b) => a.sequence - b.sequence);
  }
}

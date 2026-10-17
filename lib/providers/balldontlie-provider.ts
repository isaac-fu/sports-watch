import { mockTeams } from "@/lib/mock-repository";
import type { Game, Team } from "@/lib/models";
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
  home_team: BdlTeam;
  visitor_team: BdlTeam;
};

type BdlResponse<T> = { data: T[] };

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
  return { id: `bdl-${game.id}`, date, time, network: "NBA", venue: game.venue ?? "NBA arena", status: mapStatus(game), home: mapTeam(game.home_team), away: mapTeam(game.visitor_team) };
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
}

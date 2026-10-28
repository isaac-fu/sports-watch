import type { Game } from "./models";

export type BoxScoreLine = {
  playerId?: string;
  name: string;
  minutes: string | null;
  comment?: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  fieldGoals: string | null;
  threePointers: string | null;
  freeThrows: string | null;
  freeThrowsMade: number | null;
  plusMinus: number | null;
};

export type GameBoxScore = {
  gameId: string;
  source: string;
  status: "available" | "pending" | "unavailable";
  updatedAt: string;
  teams: Array<{ teamId: string; name: string; players: BoxScoreLine[]; totals: BoxScoreLine | null }>;
};

export function emptyBoxScore(game: Game, source: string): GameBoxScore {
  return { gameId: game.id, source, status: game.status === "scheduled" ? "pending" : "unavailable", updatedAt: new Date().toISOString(), teams: [] };
}

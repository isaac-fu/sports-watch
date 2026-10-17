import type { Game } from "@/lib/models";

export type GameFilters = { teamId?: string; from?: string; to?: string };

export interface NbaProvider {
  readonly name: string;
  getGames(filters?: GameFilters): Promise<Game[]>;
}

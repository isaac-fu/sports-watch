import type { ProviderCatalog } from "@/lib/catalog";
import type { Game, GameEvent } from "@/lib/models";

export type GameFilters = { teamId?: string; from?: string; to?: string };

export interface NbaProvider {
  readonly name: string;
  getGames(filters?: GameFilters): Promise<Game[]>;
  getGame(gameId: string): Promise<Game | null>;
  getGameEvents(gameId: string): Promise<GameEvent[]>;
}

export interface CatalogProvider {
  readonly name: string;
  getCatalogIdentities(): Promise<ProviderCatalog>;
}

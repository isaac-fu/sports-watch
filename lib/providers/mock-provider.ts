import { getGameEvents, getGames } from "@/lib/mock-repository";
import type { NbaProvider } from "./types";

export const mockProvider: NbaProvider = {
  name: "mock-repository",
  async getGames(filters) {
    return getGames(filters);
  },
  async getGame(gameId) {
    return getGames().find((game) => game.id === gameId) ?? null;
  },
  async getGameEvents(gameId) {
    return getGameEvents(gameId);
  },
};

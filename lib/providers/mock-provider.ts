import { getGames } from "@/lib/mock-repository";
import type { NbaProvider } from "./types";

export const mockProvider: NbaProvider = {
  name: "mock-repository",
  async getGames(filters) {
    return getGames(filters);
  },
};

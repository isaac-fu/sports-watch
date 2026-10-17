import type { Account, Preferences } from "./models";

type AppStore = { account: Account; preferences: Preferences };

export const demoAccountId = "account-demo";

const defaultStore: AppStore = {
  account: { id: demoAccountId, displayName: "Alex Morgan", email: "alex@example.com", timezone: "America/Los_Angeles", createdAt: "2025-01-12T18:00:00.000Z" },
  preferences: { followedTeamIds: ["gsw"], followedPlayerIds: ["stephen-curry"], alerts: { gameStarting: true, closeGame: true, finalScore: true, standoutPerformance: false } },
};

declare global { var __courtsideStore: AppStore | undefined; }

export const appStore = globalThis.__courtsideStore ?? (globalThis.__courtsideStore = structuredClone(defaultStore));

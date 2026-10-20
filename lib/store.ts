import type { Account, AlertPreferences, Preferences } from "./models";

type AppStore = { account: Account; preferences: Preferences };

export const demoAccountId = "account-demo";

export const defaultAlertPreferences: AlertPreferences = {
  gameStarting: true,
  closeGame: true,
  finalScore: true,
  standoutPerformance: false,
  injuryUpdate: true,
  leadChange: true,
  milestone: false,
};

export function createDefaultPreferences(followDemoFavorites = false): Preferences {
  return {
    followedTeamIds: followDemoFavorites ? ["gsw"] : [],
    followedPlayerIds: followDemoFavorites ? ["stephen-curry"] : [],
    alerts: { ...defaultAlertPreferences },
  };
}

const defaultStore: AppStore = {
  account: { id: demoAccountId, displayName: "Alex Morgan", email: "alex@example.com", timezone: "America/Los_Angeles", createdAt: "2025-01-12T18:00:00.000Z", emailVerified: true },
  preferences: createDefaultPreferences(true),
};

declare global { var __courtsideStore: AppStore | undefined; }

export const appStore = globalThis.__courtsideStore ?? (globalThis.__courtsideStore = structuredClone(defaultStore));

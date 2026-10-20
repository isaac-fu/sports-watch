import { loadPreferences, savePreferences } from "./db";
import { appStore, createDefaultPreferences, defaultAlertPreferences, demoAccountId } from "./store";
import type { Preferences } from "./models";

declare global { var __courtsidePreferencesByAccount: Record<string, Preferences> | undefined; }

const memoryPreferences = globalThis.__courtsidePreferencesByAccount ?? (globalThis.__courtsidePreferencesByAccount = {
  [demoAccountId]: appStore.preferences,
});

function normalizePreferences(preferences: Preferences): Preferences {
  return {
    ...preferences,
    followedTeamIds: preferences.followedTeamIds ?? [],
    followedPlayerIds: preferences.followedPlayerIds ?? [],
    alerts: { ...defaultAlertPreferences, ...preferences.alerts },
  };
}

export function cachePreferences(accountId: string, preferences: Preferences) {
  const normalized = normalizePreferences(preferences);
  memoryPreferences[accountId] = normalized;
  if (accountId === demoAccountId) appStore.preferences = normalized;
}

export async function getCurrentPreferences(accountId = demoAccountId): Promise<Preferences> {
  if (accountId === demoAccountId) return normalizePreferences(createDefaultPreferences(true));
  const persisted = await loadPreferences(accountId);
  if (persisted) cachePreferences(accountId, persisted);
  const current = memoryPreferences[accountId] ?? createDefaultPreferences(accountId === demoAccountId);
  const normalized = normalizePreferences(current);
  cachePreferences(accountId, normalized);
  return normalized;
}

export async function updateCurrentPreferences(accountId: string, preferences: Preferences): Promise<Preferences> {
  if (accountId === demoAccountId) throw new Error("The shared demo profile is read-only.");
  const normalized = normalizePreferences(preferences);
  cachePreferences(accountId, normalized);
  await savePreferences(accountId, normalized);
  return normalized;
}

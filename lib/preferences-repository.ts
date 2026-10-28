import { loadPreferences, savePreferences } from "./db";
import { appStore, createDefaultPreferences, defaultAlertPreferences, demoAccountId } from "./store";
import type { Preferences } from "./models";
import { normalizeNewsFeedback } from "./news-feedback";

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
    ...(preferences.newsFeedback ? { newsFeedback: normalizeNewsFeedback(preferences.newsFeedback) } : {}),
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
  const current = await getCurrentPreferences(accountId);
  // Feedback can only be changed through the validated article feedback endpoint.
  const normalized = normalizePreferences({ ...preferences, newsFeedback: current.newsFeedback });
  const saved = await savePreferences(accountId, normalized);
  if (!saved && process.env.DATABASE_URL) throw new Error("Unable to save preferences.");
  cachePreferences(accountId, normalized);
  return normalized;
}

import { loadPreferences, savePreferences } from "./db";
import { appStore, demoAccountId } from "./store";
import type { Preferences } from "./models";

export async function getCurrentPreferences(): Promise<Preferences> {
  const persisted = await loadPreferences(demoAccountId);
  if (persisted) appStore.preferences = persisted;
  return appStore.preferences;
}

export async function updateCurrentPreferences(preferences: Preferences): Promise<Preferences> {
  appStore.preferences = preferences;
  await savePreferences(demoAccountId, preferences);
  return preferences;
}

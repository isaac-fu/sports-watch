"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { ACCENT_PRESETS, ACCENT_STORAGE_KEY, BRAND_ACCENTS, createAccentPalette, normalizeHex, type AccentTheme } from "@/lib/theme-colors";
import "./appearance-colors.css";

let savedColor: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const snapshot = () => savedColor;
const serverSnapshot = () => null;

function readSavedColor() {
  try { savedColor = normalizeHex(window.localStorage.getItem(ACCENT_STORAGE_KEY)); }
  catch { savedColor = null; }
}

function storageChanged(event: StorageEvent) {
  if (event.key !== ACCENT_STORAGE_KEY && event.key !== null) return;
  // Also handles another tab's reset or localStorage.clear().
  readSavedColor();
  notify();
}

function subscribe(listener: () => void) {
  if (!initialized) { readSavedColor(); initialized = true; }
  if (!listeners.size) window.addEventListener("storage", storageChanged);
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("storage", storageChanged);
      initialized = false;
    }
  };
}

/** Mount once in the app shell, or render AppearanceColors with controls={false}.
 * Additional Settings instances share the same store. Pass the same current theme
 * to each. Root accent styles intentionally survive Settings unmounting.
 * This hook never changes data-theme or the existing theme storage key.
 */
export function useAccentTheme(theme: AccentTheme) {
  const color = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [storageNotice, setStorageNotice] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const palette = createAccentPalette(color, theme);
    const names = ["selected", "text", "foreground", "canvas", "panel", "raised", "line", "soft", "ring"];
    if (!palette) {
      delete root.dataset.accentColor;
      names.forEach((name) => root.style.removeProperty(`--sw-accent-${name}`));
      return;
    }
    Object.entries(palette).forEach(([name, value]) => root.style.setProperty(`--sw-accent-${name}`, value));
    root.dataset.accentColor = palette.selected;
  }, [color, theme]);

  function setColor(value: string | null) {
    const normalized = normalizeHex(value);
    if (value !== null && !normalized) return;
    savedColor = normalized;
    try {
      if (normalized) window.localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
      else window.localStorage.removeItem(ACCENT_STORAGE_KEY);
      setStorageNotice("");
    } catch {
      setStorageNotice("Color applied for this visit. Your browser could not save the preference.");
    }
    notify();
  }

  return { color, setColor, reset: () => setColor(null), storageNotice };
}

export function AppearanceColors({ theme, controls = true }: { theme: AccentTheme; controls?: boolean }) {
  const { color, setColor, reset, storageNotice } = useAccentTheme(theme);
  const effectiveColor = color ?? BRAND_ACCENTS[theme];
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const inputValue = draft ?? effectiveColor;
  const invalid = normalizeHex(inputValue) === null;

  // A theme change, reset, or change from another mounted instance replaces a draft.
  useEffect(() => setDraft(null), [effectiveColor]);
  if (!controls) return null;

  function applyDraft() {
    const next = normalizeHex(inputValue);
    if (next) { setColor(next); setDraft(null); }
  }

  return <section className="appearance-colors" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Accent color</h3>
    <p id={`${id}-help`}>Choose a color for buttons and highlights in both themes. Dark mode uses matching deep-tinted surfaces. Text shades adjust for readability.</p>
    <div className="appearance-colors-fields">
      <label htmlFor={`${id}-picker`}>Custom color
        <input id={`${id}-picker`} type="color" value={effectiveColor} aria-describedby={`${id}-help`} onChange={(event) => { setDraft(null); setColor(event.target.value); }} />
      </label>
      <label htmlFor={`${id}-hex`}>Hex color
        <input id={`${id}-hex`} type="text" value={inputValue} spellCheck={false} autoComplete="off" maxLength={7} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : `${id}-help`} onChange={(event) => setDraft(event.target.value)} onBlur={applyDraft} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); applyDraft(); }
          if (event.key === "Escape") { event.preventDefault(); setDraft(null); }
        }} />
      </label>
      <button type="button" onClick={applyDraft} disabled={invalid}>Apply hex</button>
    </div>
    {invalid && <p id={`${id}-error`} role="alert">Enter three or six hex digits, for example #9867eb.</p>}
    <div className="appearance-colors-presets" role="group" aria-label="Accent color presets">
      {ACCENT_PRESETS.map((preset) => <button key={preset.name} type="button" aria-pressed={color === preset.color} onClick={() => { setDraft(null); setColor(preset.color); }}>
        <span aria-hidden="true" style={{ backgroundColor: preset.color }} />{preset.name}
      </button>)}
    </div>
    <button className="appearance-colors-reset" type="button" onClick={() => { setDraft(null); reset(); }}>Reset to brand blue</button>
    <p role="status">{storageNotice || (color ? `Custom accent: ${color.toUpperCase()}` : "Using the original blue palette for each theme.")}</p>
  </section>;
}

export default AppearanceColors;

export type AccentTheme = "light" | "dark";
export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export const ACCENT_STORAGE_KEY = "sports-watch-accent-color";
export const BRAND_ACCENTS = { light: "#256fe8", dark: "#4d8dff" } as const;
export const ACCENT_PRESETS = [
  { name: "Blue", color: "#4d8dff" },
  { name: "Violet", color: "#9867eb" },
  { name: "Rose", color: "#e45d91" },
  { name: "Orange", color: "#e9893d" },
  { name: "Teal", color: "#28a99a" },
] as const;

/** Only opaque RGB hex is accepted; storage and CSS never receive arbitrary text. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) return `#${hex.split("").map((c) => c + c).join("")}`.toLowerCase();
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

export function hexToRgb(value: string): RGB {
  const hex = normalizeHex(value);
  if (!hex) throw new Error("Expected a three- or six-digit RGB hex color");
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

const clamp = (n: number, max = 1) => Math.min(max, Math.max(0, n));

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((n) => Math.round(clamp(n, 255)).toString(16).padStart(2, "0")).join("")}`;
}

/** Hue in degrees, saturation and lightness in [0, 1]. */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const [red, green, blue] = [r, g, b].map((n) => clamp(n, 255) / 255);
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
  const delta = max - min, l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const sector = max === red ? (green - blue) / delta : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return { h: (sector * 60 + 360) % 360, s: delta / (1 - Math.abs(2 * l - 1)), l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hue = ((h % 360) + 360) % 360 / 60;
  const light = clamp(l), chroma = (1 - Math.abs(2 * light - 1)) * clamp(s);
  const x = chroma * (1 - Math.abs(hue % 2 - 1)), m = light - chroma / 2;
  const channels = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return { r: Math.round((channels[0] + m) * 255), g: Math.round((channels[1] + m) * 255), b: Math.round((channels[2] + m) * 255) };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [red, green, blue] = [r, g, b].map((n) => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a), second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function readableForeground(background: string): "#000000" | "#ffffff" {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}

export function createAccentPalette(value: unknown, theme: AccentTheme) {
  const selected = normalizeHex(value);
  if (!selected) return null;
  const { h, s } = rgbToHsl(hexToRgb(selected));
  // Muted, coordinated hue surfaces complement the accent without saturating the UI.
  const tint = (l: number) => rgbToHex(hslToRgb({ h, s: Math.min(s, 0.24), l }));
  const dark = theme === "dark";
  const canvas = tint(dark ? 0.055 : 0.965);
  const panel = tint(dark ? 0.09 : 0.995);
  const raised = tint(dark ? 0.135 : 0.94);
  const source = hexToRgb(selected);
  let text = selected;
  // Check rounded sRGB output, including the lightest/darkest panel, not just canvas.
  for (let step = 0; step <= 255; step++) {
    const target = dark ? 255 : 0, amount = step / 255;
    text = rgbToHex({ r: source.r + (target - source.r) * amount, g: source.g + (target - source.g) * amount, b: source.b + (target - source.b) * amount });
    if ([canvas, panel, raised].every((bg) => contrastRatio(text, bg) >= 4.5)) break;
  }
  return {
    selected, text, foreground: readableForeground(selected), canvas, panel, raised,
    line: tint(dark ? 0.25 : 0.82),
    soft: `${selected}${dark ? "26" : "14"}`,
    ring: `${selected}55`,
  };
}

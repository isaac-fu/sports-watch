/** A soft team-color tint that keeps transparent logos readable in either theme. */
export function teamIconStyle(color?: string) {
  const accent = color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#7185a3";
  return {
    background: `color-mix(in srgb, ${accent} 22%, var(--panel-raised))`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 45%, var(--line))`,
    color: "var(--ink)",
  };
}

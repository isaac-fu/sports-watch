export const PACIFIC_TIME_ZONE = "America/Los_Angeles";
export const PACIFIC_DISPLAY_LABEL = "PST";

const pacificTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const pacificDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function pacificDateKey(startsAt: string | undefined, fallback: string) {
  const date = validDate(startsAt);
  if (!date) return fallback;
  const parts = pacificDateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatPacificTipTime(startsAt: string | undefined, fallback: string) {
  const date = validDate(startsAt);
  if (date) return `${pacificTimeFormatter.format(date)} ${PACIFIC_DISPLAY_LABEL}`;
  if (!fallback || /^(TBD|Live|Final)$/i.test(fallback.trim())) return fallback || "TBD";
  const withoutZone = fallback.trim().replace(/\s+(?:PST|PDT|PT)$/i, "");
  return `${withoutZone} ${PACIFIC_DISPLAY_LABEL}`;
}

export function scheduledGameTimestamp(game: { startsAt?: string; date: string; time: string }) {
  const exact = validDate(game.startsAt);
  if (exact) return exact.getTime();
  const fallback = new Date(`${game.date} ${game.time.replace(/\s+(?:PST|PDT|PT)$/i, "")}`);
  return fallback.getTime();
}

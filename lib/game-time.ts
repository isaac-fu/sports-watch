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

export function validTimeZone(value?: string) {
  if (!value) return PACIFIC_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return PACIFIC_TIME_ZONE;
  }
}

function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")) - date.getTime();
}

function pacificFallbackDate(gameDate: string | undefined, fallback: string) {
  const match = gameDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/) && fallback.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match || !gameDate) return null;
  const time = fallback.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)!;
  const [year, month, day] = gameDate.split("-").map(Number);
  let hour = Number(time[1]) % 12;
  if (time[3].toUpperCase() === "PM") hour += 12;
  const tentative = Date.UTC(year, month - 1, day, hour, Number(time[2] ?? 0));
  const instant = new Date(tentative);
  return new Date(tentative - zoneOffsetMs(instant, PACIFIC_TIME_ZONE));
}

export function dateKeyInTimeZone(startsAt: string | undefined, fallback: string, timeZone: string) {
  const date = validDate(startsAt);
  return date ? dateKey(date, validTimeZone(timeZone)) : fallback;
}

export function formatTipTime(startsAt: string | undefined, fallback: string, timeZone: string, gameDate?: string) {
  if (!fallback || /^(TBD|Live|Final)$/i.test(fallback.trim())) return fallback || "TBD";
  const zone = validTimeZone(timeZone);
  const date = validDate(startsAt) ?? pacificFallbackDate(gameDate, fallback);
  if (!date) return fallback.trim().replace(/\s+(?:PST|PDT|PT)$/i, "");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export function timeZoneDisplayName(timeZone: string, at = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: validTimeZone(timeZone), timeZoneName: "short" })
    .formatToParts(at).find((item) => item.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function greetingForTimeZone(timeZone: string, at = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: validTimeZone(timeZone), hour: "numeric", hourCycle: "h23" })
    .formatToParts(at).find((item) => item.type === "hour")?.value ?? 12);
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function formatLongDateInTimeZone(timeZone: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: validTimeZone(timeZone),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(at);
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

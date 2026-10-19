const minuteMs = 60_000;

export const feedFreshnessThresholdsMs = [1, 5, 10, 30, 60].map((minutes) => minutes * minuteMs);

export function feedFreshnessLabel(lastRefreshedAt: number, now = Date.now()) {
  const elapsedMinutes = Math.max(0, Math.floor((now - lastRefreshedAt) / minuteMs));
  if (elapsedMinutes < 1) return "";
  if (elapsedMinutes >= 60) return "Feed hasn’t been refreshed for at least 1 hour.";
  if (elapsedMinutes >= 30) return "Feed hasn’t been refreshed for 30 minutes.";
  if (elapsedMinutes >= 10) return "Feed hasn’t been refreshed for 10 minutes.";
  if (elapsedMinutes >= 5) return "Feed hasn’t been refreshed for 5 minutes.";
  return "Feed hasn’t been refreshed for 1 minute.";
}

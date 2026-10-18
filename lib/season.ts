export function currentNbaSeasonStart(now = new Date()) {
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

export function nbaSeasonLabel(seasonStart: number) {
  return `${seasonStart}-${String((seasonStart + 1) % 100).padStart(2, "0")}`;
}

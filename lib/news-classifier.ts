import type { Player, Team } from "./models";

export const normalizeNewsText = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const containsPhrase = (text: string, phrase: string) => {
  const normalizedPhrase = normalizeNewsText(phrase);
  return normalizedPhrase.length > 0 && ` ${text} `.includes(` ${normalizedPhrase} `);
};

const teamAliases: Record<string, string[]> = {
  CLE: ["Cavs"],
  DAL: ["Mavs"],
  GSW: ["Dubs"],
  MIN: ["Wolves", "Timberwolves"],
  NOP: ["Pels"],
  PHI: ["Sixers"],
  POR: ["Blazers"],
};

function playerLastNameCounts(players: Player[]) {
  const lastNameCounts = new Map<string, number>();
  players.forEach((player) => {
    const lastName = normalizeNewsText(player.name).split(" ").at(-1) ?? "";
    if (lastName.length >= 4) lastNameCounts.set(lastName, (lastNameCounts.get(lastName) ?? 0) + 1);
  });
  return lastNameCounts;
}

export function classifyNewsText(parts: Array<string | undefined>, teams: Team[], players: Player[]) {
  const text = normalizeNewsText(parts.filter(Boolean).join(" "));
  const lastNameCounts = playerLastNameCounts(players);
  const explicitTeamIds = teams.filter((team) => {
    const nickname = team.name.split(" ").at(-1) ?? "";
    const aliases = [team.name, team.short, nickname, ...(teamAliases[team.short.toUpperCase()] ?? [])];
    return aliases.some((alias) => alias.length > 2 && containsPhrase(text, alias));
  }).map((team) => team.id);
  const playerIds = players.filter((player) => {
    if (containsPhrase(text, player.name)) return true;
    const lastName = normalizeNewsText(player.name).split(" ").at(-1) ?? "";
    const surnameHasContext = lastNameCounts.get(lastName) === 1 || explicitTeamIds.includes(player.teamId);
    return lastName.length >= 4 && surnameHasContext && containsPhrase(text, lastName);
  }).map((player) => player.id);
  const inferredTeamIds = players.filter((player) => playerIds.includes(player.id)).map((player) => player.teamId);
  const teamIds = Array.from(new Set([...explicitTeamIds, ...inferredTeamIds]));
  const nbaRelated = teamIds.length > 0
    || playerIds.length > 0
    || containsPhrase(text, "NBA")
    || containsPhrase(text, "National Basketball Association");
  return { text, teamIds, playerIds, nbaRelated };
}

export function classifyAndTagNews(parts: Array<string | undefined>, teams: Team[], players: Player[]) {
  const classified = classifyNewsText(parts, teams, players);
  const tags = ["nba"];
  if (/\b(injur|sprain|strain|out for|questionable|doubtful)\w*\b/.test(classified.text)) tags.push("injury");
  if (/\b(trade|sign|waive|contract|roster)\w*\b/.test(classified.text)) tags.push("roster");
  if (/\b(score|win|loss|defeat|points|assists|rebounds|recap)\w*\b/.test(classified.text)) tags.push("performance");
  return { ...classified, tags };
}

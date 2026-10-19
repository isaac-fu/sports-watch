type SearchableTeam = { name: string; short: string };
type SearchablePlayer = { name: string; teamName: string; position: string };

const normalize = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/gi, " ")
  .trim()
  .toLowerCase();

function terms(query: string) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

function matches(fields: string[], query: string) {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return true;
  const haystack = normalize(fields.join(" "));
  return queryTerms.every((term) => haystack.includes(term));
}

export function searchTeams<T extends SearchableTeam>(teams: T[], query: string) {
  return teams.filter((team) => matches([team.name, team.short], query));
}

export function searchPlayers<T extends SearchablePlayer>(players: T[], query: string) {
  return players.filter((player) => matches([player.name, player.teamName, player.position], query));
}

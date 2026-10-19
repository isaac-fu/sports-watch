import { mockPlayers, mockTeams } from "./mock-repository";
import type { Player, Team } from "./models";

export type Catalog = { teams: Team[]; players: Player[] };
export type ProviderTeamIdentity = { providerId: string; name: string; short: string };
export type ProviderPlayerIdentity = { providerId: string; name: string; position: string; teamProviderId: string };
export type ProviderCatalog = { teams: ProviderTeamIdentity[]; players: ProviderPlayerIdentity[] };

const cloneTeam = (team: Team): Team => ({ ...team, providerIds: { ...team.providerIds } });
const clonePlayer = (player: Player): Player => ({ ...player, providerIds: { ...player.providerIds } });

export const canonicalTeams = mockTeams.map(cloneTeam);
export const canonicalPlayers = mockPlayers.map(clonePlayer);

export function getCatalog(): Catalog {
  return { teams: canonicalTeams, players: canonicalPlayers };
}

export function findCanonicalTeam(teamId: string) {
  return canonicalTeams.find((team) => team.id === teamId) ?? null;
}

export function findCanonicalPlayer(playerId: string) {
  return canonicalPlayers.find((player) => player.id === playerId) ?? null;
}

export function findTeamByProviderId(provider: string, providerId: string) {
  return canonicalTeams.find((team) => team.providerIds?.[provider] === providerId) ?? null;
}

export function findPlayerByProviderId(provider: string, providerId: string) {
  return canonicalPlayers.find((player) => player.providerIds?.[provider] === providerId) ?? null;
}

export function mergeProviderId<T extends Team | Player>(entity: T, provider: string, providerId: string): T {
  return { ...entity, providerIds: { ...entity.providerIds, [provider]: providerId } };
}

export function replaceCanonicalCatalog(catalog: Catalog) {
  canonicalTeams.splice(0, canonicalTeams.length, ...catalog.teams.map(cloneTeam));
  canonicalPlayers.splice(0, canonicalPlayers.length, ...catalog.players.map(clonePlayer));
}

const normalizedName = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
const slug = (value: string) => normalizedName(value).replace(/\s+/g, "-") || "entity";

function uniqueId(preferred: string, providerId: string, usedIds: Set<string>) {
  if (!usedIds.has(preferred)) return preferred;
  return `${preferred}-${providerId}`;
}

function positionName(position: string) {
  const positions: Record<string, string> = { G: "Guard", F: "Forward", C: "Center", "G-F": "Guard / Forward", "F-G": "Forward / Guard", "F-C": "Forward / Center", "C-F": "Center / Forward" };
  return positions[position.toUpperCase()] ?? (position || "Player");
}

export function reconcileProviderCatalog(provider: string, incoming: ProviderCatalog, base: Catalog = getCatalog()): Catalog {
  const usedTeamIds = new Set(base.teams.map((team) => team.id));
  const baseTeamsByName = new Map(base.teams.map((team) => [normalizedName(team.name), team]));
  const teams = incoming.teams.map((incomingTeam) => {
    const known = base.teams.find((team) => team.providerIds?.[provider] === incomingTeam.providerId)
      ?? base.teams.find((team) => team.short.toUpperCase() === incomingTeam.short.toUpperCase())
      ?? baseTeamsByName.get(normalizedName(incomingTeam.name));
    const id = known?.id ?? uniqueId(slug(incomingTeam.short), incomingTeam.providerId, usedTeamIds);
    usedTeamIds.add(id);
    return {
      ...(known ?? { id, color: "#777b75", record: "—" }),
      id,
      name: incomingTeam.name,
      short: incomingTeam.short.toUpperCase(),
      providerIds: { ...known?.providerIds, [provider]: incomingTeam.providerId },
    } satisfies Team;
  });

  const teamsByProviderId = new Map(teams.map((team) => [team.providerIds?.[provider], team]));
  const usedPlayerIds = new Set(base.players.map((player) => player.id));
  const basePlayersByName = new Map(base.players.map((player) => [normalizedName(player.name), player]));
  const players = incoming.players.flatMap((incomingPlayer) => {
    const team = teamsByProviderId.get(incomingPlayer.teamProviderId);
    if (!team) return [];
    const known = base.players.find((player) => player.providerIds?.[provider] === incomingPlayer.providerId)
      ?? basePlayersByName.get(normalizedName(incomingPlayer.name));
    const id = known?.id ?? uniqueId(slug(incomingPlayer.name), incomingPlayer.providerId, usedPlayerIds);
    usedPlayerIds.add(id);
    const initials = incomingPlayer.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    return [{
      ...(known ?? { id, initials, color: team.color }),
      id,
      name: incomingPlayer.name,
      teamId: team.id,
      teamName: team.name,
      position: incomingPlayer.position ? positionName(incomingPlayer.position) : known?.position ?? "Player",
      providerIds: { ...known?.providerIds, [provider]: incomingPlayer.providerId },
    } satisfies Player];
  });

  return { teams, players };
}

export function teamIds() {
  return new Set(canonicalTeams.map((team) => team.id));
}

export function playerIds() {
  return new Set(canonicalPlayers.map((player) => player.id));
}

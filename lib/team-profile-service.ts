import type { TeamProfile, TeamStat } from "./models";
import { loadNewsArticles, loadSeasonStats } from "./content-repository";
import { getGames, mockPlayers, mockTeams } from "./mock-repository";
import { getNbaProvider } from "./providers";
import { currentNbaSeasonStart, nbaSeasonLabel } from "./season";

type CachedTeamProfile = { profile: TeamProfile; expiresAt: number };

declare global { var __courtsideTeamProfiles: Map<string, CachedTeamProfile> | undefined; }

const teamProfileCache = globalThis.__courtsideTeamProfiles ?? (globalThis.__courtsideTeamProfiles = new Map());
const cacheDurationMs = 10 * 60 * 1000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function fallbackStats(teamId: string, teamName: string, record: string): TeamStat {
  const [wins = 0, losses = 0] = record.split(/[–-]/).map(Number);
  const index = Math.max(0, mockTeams.findIndex((team) => team.id === teamId));
  return {
    teamId,
    teamName,
    wins: Number.isFinite(wins) ? wins : 0,
    losses: Number.isFinite(losses) ? losses : 0,
    conferenceRank: 1 + (index * 2) % 15,
    pointsPerGame: Number((111.8 + (index * 1.17) % 8).toFixed(1)),
    pointsAllowedPerGame: Number((108.9 + (index * 1.31) % 8).toFixed(1)),
  };
}

export async function getTeamProfile(teamId: string): Promise<TeamProfile | null> {
  const team = mockTeams.find((item) => item.id === teamId);
  if (!team) return null;

  const cached = teamProfileCache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const season = currentNbaSeasonStart();
  const provider = getNbaProvider();
  const from = new Date();
  from.setDate(from.getDate() - 45);
  const to = new Date();
  to.setDate(to.getDate() + 180);

  const [statsSnapshot, newsSnapshot, providerGames] = await Promise.all([
    loadSeasonStats(season),
    loadNewsArticles(),
    provider.getGames({ teamId, from: dateKey(from), to: dateKey(to) }).catch(() => getGames({ teamId, from: dateKey(from), to: dateKey(to) })),
  ]);
  const games = providerGames.filter((game) => game.home.id === teamId || game.away.id === teamId);
  const stats = statsSnapshot.teams.find((item) => item.teamId === teamId) ?? fallbackStats(team.id, team.name, team.record);
  const profile: TeamProfile = {
    team,
    seasonLabel: nbaSeasonLabel(season),
    stats,
    roster: mockPlayers.filter((player) => player.teamId === teamId),
    recentGames: games.filter((game) => game.status === "final").sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5),
    upcomingGames: games.filter((game) => game.status !== "final").sort((left, right) => left.date.localeCompare(right.date)).slice(0, 5),
    articles: newsSnapshot.articles.filter((article) => article.teamIds.includes(teamId)).slice(0, 5),
    source: provider.name === "mock-repository" ? "mock-repository" : `${provider.name} + ${statsSnapshot.source}`,
    updatedAt: new Date().toISOString(),
  };
  teamProfileCache.set(teamId, { profile, expiresAt: Date.now() + cacheDurationMs });
  return profile;
}

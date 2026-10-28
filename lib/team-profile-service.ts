import type { TeamProfile, TeamStat } from "./models";
import { canonicalPlayers, canonicalTeams } from "./catalog";
import { loadCatalog } from "./catalog-repository";
import { loadNewsArticles, loadSeasonStats } from "./content-repository";
import { getNbaProvider, getStatsProvider } from "./providers";
import { currentNbaSeasonStart, nbaSeasonLabel } from "./season";
import { buildTeamStandings, calculateTeamMetricRankings } from "./team-standings";
import { publicNewsArticle } from "./news-text";
import { createNbaGameProvider } from "./game-provider";

type CachedTeamProfile = { profile: TeamProfile; expiresAt: number };

declare global { var __courtsideTeamProfiles: Map<string, CachedTeamProfile> | undefined; }

const teamProfileCache = globalThis.__courtsideTeamProfiles ?? (globalThis.__courtsideTeamProfiles = new Map());
const cacheDurationMs = 10 * 60 * 1000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function fallbackStats(teamId: string, teamName: string, record: string): TeamStat {
  const [wins = 0, losses = 0] = record.split(/[–-]/).map(Number);
  const index = Math.max(0, canonicalTeams.findIndex((team) => team.id === teamId));
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
  await loadCatalog();
  const team = canonicalTeams.find((item) => item.id === teamId);
  if (!team) return null;

  const cached = teamProfileCache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const season = currentNbaSeasonStart();
  const provider = (process.env.SPORTS_DATA_PROVIDER ?? "mock").trim().toLowerCase() === "mock"
    && process.env.STATS_DATA_PROVIDER !== "nba_api"
    ? getNbaProvider() : createNbaGameProvider();
  const statsProvider = getStatsProvider();
  const from = new Date();
  from.setDate(from.getDate() - 45);
  const to = new Date();
  to.setDate(to.getDate() + 180);

  const [statsSnapshot, newsSnapshot, gamesSnapshot, providerStats, providerStandings] = await Promise.all([
    loadSeasonStats(season),
    loadNewsArticles(),
    provider.getGames({ teamId, from: dateKey(from), to: dateKey(to) })
      .then((games) => ({ games, source: provider.name }))
      .catch(() => ({ games: [], source: `${provider.name}-unavailable` })),
    statsProvider.getTeamStats(team, season).catch(() => null),
    statsProvider.getTeamStandings(season).catch(() => null),
  ]);
  const games = gamesSnapshot.games.filter((game) => game.home.id === teamId || game.away.id === teamId);
  const leagueStats = providerStandings?.teams.length ? providerStandings.teams : statsSnapshot.teams;
  const stats = leagueStats.find((item) => item.teamId === teamId) ?? providerStats ?? statsSnapshot.teams.find((item) => item.teamId === teamId) ?? fallbackStats(team.id, team.name, team.record);
  const rankingPool = leagueStats.some((item) => item.teamId === teamId) ? leagueStats : [...leagueStats, stats];
  const standingsSeason = providerStandings?.teams.length ? providerStandings.season : stats.season ?? season;
  const source = Array.from(new Set([gamesSnapshot.source, providerStats || providerStandings ? statsProvider.name : statsSnapshot.source])).join(" + ");
  const profile: TeamProfile = {
    team,
    seasonLabel: nbaSeasonLabel(stats.season ?? season),
    stats,
    rankings: calculateTeamMetricRankings(teamId, rankingPool),
    standings: buildTeamStandings(canonicalTeams, rankingPool),
    standingsSeasonLabel: nbaSeasonLabel(standingsSeason),
    standingsUsesPreviousSeason: standingsSeason < season,
    roster: canonicalPlayers.filter((player) => player.teamId === teamId),
    recentGames: games.filter((game) => game.status === "final").sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5),
    upcomingGames: games.filter((game) => game.status !== "final").sort((left, right) => left.date.localeCompare(right.date)).slice(0, 5),
    articles: newsSnapshot.articles.filter((article) => article.teamIds.includes(teamId)).slice(0, 5).map(publicNewsArticle),
    source,
    updatedAt: new Date().toISOString(),
  };
  teamProfileCache.set(teamId, { profile, expiresAt: Date.now() + (gamesSnapshot.source.endsWith("-unavailable") ? 30_000 : cacheDurationMs) });
  return profile;
}

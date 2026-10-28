"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { dateKeyInTimeZone, formatLongDateInTimeZone, formatTipTime, greetingForTimeZone, timeZoneDisplayName } from "@/lib/game-time";
import { searchPlayers, searchTeams } from "@/lib/entity-search";
import { feedFreshnessLabel, feedFreshnessThresholdsMs } from "@/lib/feed-freshness";
import { filterGamesByTeamScope, upcomingGamesForDay, type GameFilterScope } from "@/lib/game-filter";
import { AppearanceColors, useAccentTheme } from "./appearance-colors";
import { NewsInterestMenu } from "./news-interest-menu";
import { LeaderboardView } from "./leaderboard-view";
import { leaderboardMetrics, type LeaderboardMetric } from "@/lib/leaderboard";
import { GameCatchUpStory } from "./game-catchup-story";
import type { CatchUpMoment as SharedCatchUpMoment } from "@/lib/models";
import { BoxScoreView } from "./box-score-view";
import { ScheduleCache, scheduleTtlMs } from "@/lib/schedule-cache";
import { currentNbaSeasonStart, nbaSeasonLabel } from "@/lib/season";

type SchedulePayload = { data: ApiGame[]; meta?: { unavailable?: boolean; stale?: boolean; expiresAt?: number; retryAt?: number; rateLimited?: boolean } };
const monthCache = new ScheduleCache<SchedulePayload>();

type FeedItem = {
  id: string;
  kind: "story" | "game" | "performance" | "injury";
  eyebrow: string;
  title: string;
  body: string;
  publishedAt: string;
  accent: "gold" | "blue" | "coral";
  teamIds: string[];
  playerIds: string[];
  reason: string;
  relevanceScore: number;
};

type NewsArticleData = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  teamIds: string[];
  playerIds: string[];
  tags: string[];
};
type SavedArticleData = NewsArticleData & { savedAt: string };

type Team = {
  id: string;
  name: string;
  short: string;
  color: string;
  record: string;
  imageUrl?: string;
};

type Player = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  position: string;
  initials: string;
  color: string;
  imageUrl?: string;
};

type Account = { id: string; displayName: string; email: string; timezone: string; createdAt: string; emailVerified: boolean };
type AlertPreferences = { gameStarting: boolean; closeGame: boolean; finalScore: boolean; standoutPerformance: boolean; injuryUpdate: boolean; leadChange: boolean; milestone: boolean };
type Preferences = { followedTeamIds: string[]; followedPlayerIds: string[]; alerts: AlertPreferences };
type TeamRecommendation = { team: Team; score: number; reason: string };
type PlayerRecommendation = { player: Player; score: number; reason: string };
type GameRecommendation = { game: ApiGame; score: number; reason: string };
type DiscoveryRecommendations = { teams: TeamRecommendation[]; players: PlayerRecommendation[]; games: GameRecommendation[] };
type CatchUpMoment = SharedCatchUpMoment;
type CatchUpBrief = { title: string; lede: string; readTimeMinutes: number; generatedAt: string; game: ApiGame | null; moments: CatchUpMoment[]; source: "box-score" | "news" };
type CatchUpCitationData = { url: string; title: string; startIndex: number; endIndex: number };
type DeliveredAlert = { id: string; candidateId: string; type: keyof AlertPreferences; title: string; body: string; priority: number; occurredAt: string; read: boolean; deliveredAt: string; readAt: string | null };
const alertLabels: Record<keyof AlertPreferences, string> = { gameStarting: "Game starting", closeGame: "Close game", finalScore: "Final score", standoutPerformance: "Standout performance", injuryUpdate: "Injury update", leadChange: "Late lead change", milestone: "Player milestone" };
const alertIcons: Record<keyof AlertPreferences, string> = { gameStarting: "◷", closeGame: "⌁", finalScore: "✓", standoutPerformance: "✦", injuryUpdate: "!", leadChange: "↔", milestone: "★" };

type Game = {
  id: string;
  date: string;
  homeId: string;
  home: string;
  homeShort: string;
  homeColor: string;
  homeImageUrl?: string;
  awayId: string;
  away: string;
  awayShort: string;
  awayColor: string;
  awayImageUrl?: string;
  time: string;
  startsAt?: string;
  network: string;
  venue: string;
  status: "scheduled" | "live" | "final";
  homeScore?: number;
  awayScore?: number;
  period?: number;
  clock?: string;
  updatedAt?: string;
};

type ApiGame = {
  id: string;
  date: string;
  time: string;
  startsAt?: string;
  network: string;
  venue: string;
  status: "scheduled" | "live" | "final";
  homeScore?: number;
  awayScore?: number;
  period?: number;
  clock?: string;
  updatedAt?: string;
  home: { id: string; name: string; short: string; color: string; imageUrl?: string };
  away: { id: string; name: string; short: string; color: string; imageUrl?: string };
};

type GameEvent = {
  id: string;
  gameId: string;
  sequence: number;
  period: number;
  periodLabel: string;
  clock: string;
  type: "score" | "turnover" | "foul" | "timeout" | "injury" | "milestone" | "period" | "play";
  title: string;
  description: string;
  occurredAt: string;
  teamId?: string;
  playerIds: string[];
  homeScore?: number;
  awayScore?: number;
  scoringPlay: boolean;
  scoreValue?: number;
  importanceScore: number;
};

type GameCenterData = {
  game: ApiGame;
  events: GameEvent[];
  keyMoments: GameEvent[];
  updatedAt: string;
  source: string;
  playByPlayStatus: "available" | "pending" | "unavailable";
};

type PlayerSeasonStat = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  season: number;
  seasonLabel: string;
  gamesPlayed: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  turnoversPerGame: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage?: number;
};

type PlayerCareerStat = Omit<PlayerSeasonStat, "season" | "seasonLabel" | "teamId" | "teamName"> & { seasonsPlayed: number };
type PlayerGameLog = { id: string; gameId: string; date: string; season: number; opponentName: string; opponentShort: string; homeAway: "home" | "away"; result: "W" | "L"; score: string; minutes: string; points: number; rebounds: number; assists: number; steals: number; blocks: number; turnovers: number; fieldGoals: string; threePointers: string; freeThrows?: string; plusMinus: number };
type PlayerProfileData = {
  player: Player;
  bio: { height?: string; weight?: string; jerseyNumber?: string; college?: string; country?: string; draftYear?: number; draftRound?: number; draftNumber?: number };
  currentSeason: PlayerSeasonStat | null;
  currentSeasonRankings?: { pointsPerGame: number; reboundsPerGame: number; assistsPerGame: number; stealsPerGame: number; blocksPerGame: number; freeThrowPercentage: number; fieldGoalPercentage: number; threePointPercentage: number; playerCount: number } | null;
  career: PlayerCareerStat | null;
  seasons: PlayerSeasonStat[];
  lastTenGames: PlayerGameLog[];
  source: string;
  updatedAt: string;
};
type TeamProfileData = {
  team: Team;
  seasonLabel: string;
  stats: { teamId: string; teamName: string; wins: number; losses: number; conferenceRank: number; pointsPerGame: number; pointsAllowedPerGame: number };
  rankings: { record: number; conference: number; pointsPerGame: number; pointsAllowedPerGame: number; pointDifferential: number; leagueSize: number };
  standings: Array<{ teamId: string; teamName: string; teamShort: string; color: string; imageUrl?: string; conference: "Eastern" | "Western"; conferenceRank: number; wins: number; losses: number; winPercentage: number; pointDifferential: number }>;
  standingsSeasonLabel: string;
  standingsUsesPreviousSeason: boolean;
  roster: Player[];
  recentGames: ApiGame[];
  upcomingGames: ApiGame[];
  articles: NewsArticleData[];
  source: string;
  updatedAt: string;
};

type ScheduleView = "day" | "week" | "month";
type ThemeMode = "dark" | "light";
type SettingsSection = "account" | "preferences" | "appearance";
const TimeZoneContext = createContext("America/Los_Angeles");

const defaultTeams: Team[] = [
  { id: "gsw", name: "Golden State Warriors", short: "GSW", color: "#f3b942", record: "31–27", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/gs.png" },
  { id: "nyk", name: "New York Knicks", short: "NYK", color: "#3e7bd6", record: "38–21", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png" },
  { id: "okc", name: "Oklahoma City Thunder", short: "OKC", color: "#ee7654", record: "43–16", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png" },
];

const defaultPlayers: Player[] = [
  { id: "stephen-curry", name: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", position: "Guard", initials: "SC", color: "#d99831", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3975.png" },
  { id: "jalen-brunson", name: "Jalen Brunson", teamId: "nyk", teamName: "New York Knicks", position: "Guard", initials: "JB", color: "#4a82d6", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3934672.png" },
  { id: "shai-gilgeous-alexander", name: "Shai Gilgeous-Alexander", teamId: "okc", teamName: "Oklahoma City Thunder", position: "Guard", initials: "SG", color: "#e87554", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4278073.png" },
];

const teamImageCodes: Record<string, string> = { gsw: "gs", nyk: "ny", okc: "okc", lal: "lal", bos: "bos", phx: "phx", den: "den", dal: "dal", mia: "mia", sac: "sac" };
const teamImageUrl = (teamId: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${teamImageCodes[teamId] ?? teamId}.png`;
const commonTimeZones = [
  ["America/Los_Angeles", "Pacific Time"],
  ["America/Denver", "Mountain Time"],
  ["America/Chicago", "Central Time"],
  ["America/New_York", "Eastern Time"],
  ["America/Phoenix", "Arizona Time"],
  ["America/Anchorage", "Alaska Time"],
  ["Pacific/Honolulu", "Hawaii Time"],
  ["UTC", "UTC"],
] as const;

const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date: Date) => { const day = date.getDay(); return startOfDay(addDays(date, day === 0 ? -6 : 1 - day)); };
const formatMonth = (date: Date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const formatShortDate = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const formatRelativeTime = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr${hours === 1 ? "" : "s"} ago` : new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const newestFeedFirst = (items: FeedItem[]) => [...items].sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime() || right.relevanceScore - left.relevanceScore);
const initialsFor = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const safeExternalUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
};

function renderAssistantInline(value: string): ReactNode[] {
  const tokens = value.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("__") && token.endsWith("__")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) return <em key={index}>{token.slice(1, -1)}</em>;
    return token.replace(/\*{1,3}/g, "");
  });
}

function FormattedAssistantAnswer({ value }: { value: string }) {
  const lines = value.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(<h4 key={`heading-${index}`}>{renderAssistantInline(heading[2])}</h4>);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(<ul key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderAssistantInline(item)}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push(<ol key={`ordered-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderAssistantInline(item)}</li>)}</ol>);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^[-*]\s+|^\d+[.)]\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderAssistantInline(paragraph.join(" "))}</p>);
  }
  return <div className="assistant-answer-content">{blocks}</div>;
}
type ApiErrorMeta = { verificationRequired?: boolean; previewUrl?: string; accountCreated?: boolean };

class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly meta?: ApiErrorMeta) { super(message); }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; meta?: ApiErrorMeta } | null;
    throw new ApiRequestError(payload?.error ?? `Request failed with ${response.status}`, response.status, payload?.meta);
  }
  return response.json() as Promise<T>;
}


const mapApiGame = (game: ApiGame, timeZone = "America/Los_Angeles"): Game => ({ id: game.id, date: dateKeyInTimeZone(game.startsAt, game.date, timeZone), time: game.time, startsAt: game.startsAt, network: game.network, venue: game.venue, status: game.status, homeScore: game.homeScore, awayScore: game.awayScore, period: game.period, clock: game.clock, updatedAt: game.updatedAt, homeId: game.home.id, home: game.home.name, homeShort: game.home.short, homeColor: game.home.color, homeImageUrl: game.home.imageUrl, awayId: game.away.id, away: game.away.name, awayShort: game.away.short, awayColor: game.away.color, awayImageUrl: game.away.imageUrl });

function TeamMark({ short, color, imageUrl }: { short: string; color: string; imageUrl?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <span className="team-mark" style={{ background: color }}>{imageUrl && !imageFailed ? <img src={imageUrl} alt="" aria-hidden="true" onError={() => setImageFailed(true)} /> : short}</span>;
}

function PlayerAvatar({ player, className = "" }: { player: Pick<Player, "initials" | "color" | "imageUrl">; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <span className={`avatar ${className}`} style={{ background: player.color }}>{player.imageUrl && !imageFailed ? <img src={player.imageUrl} alt="" aria-hidden="true" onError={() => setImageFailed(true)} /> : player.initials}</span>;
}

function EntitySearch({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return <label className="entity-search"><span aria-hidden="true">⌕</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} placeholder={placeholder} autoComplete="off" />{value && <button type="button" onClick={() => onChange("")} aria-label={`Clear ${label.toLowerCase()}`}>×</button>}</label>;
}

function GameScopeFilter({ value, onChange, followedCount, label }: { value: GameFilterScope; onChange: (value: GameFilterScope) => void; followedCount: number; label: string }) {
  return <div className="game-scope-filter"><span>Show</span><div className="game-scope-options" role="group" aria-label={label}><button type="button" className={value === "all" ? "active" : ""} aria-pressed={value === "all"} onClick={() => onChange("all")}>All games</button><button type="button" className={value === "following" ? "active" : ""} aria-pressed={value === "following"} onClick={() => onChange("following")}>Following <small>{followedCount}</small></button></div></div>;
}

function GameRow({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const timeZone = useContext(TimeZoneContext);
  const gameDate = new Date(`${game.date}T12:00:00`);
  return <button type="button" className="schedule-game-row game-link" onClick={onOpen} aria-label={`Open ${game.away} at ${game.home} box score`}><div className="schedule-game-date"><strong>{gameDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong><span>{gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div><div className="schedule-matchup"><div><TeamMark short={game.awayShort} color={game.awayColor} imageUrl={game.awayImageUrl} /><span>{game.away}</span></div><b>at</b><div><TeamMark short={game.homeShort} color={game.homeColor} imageUrl={game.homeImageUrl} /><span>{game.home}</span></div></div><div className="schedule-game-time"><strong>{game.status === "final" ? `${game.awayScore ?? "—"} – ${game.homeScore ?? "—"}` : formatTipTime(game.startsAt, game.time, timeZone, game.date)}</strong><span>{game.status === "final" ? "Final · Box score →" : game.status === "live" ? "Live · Box score →" : game.network}</span></div></button>;
}

function LiveGameCard({ game, onOpen }: { game: Game; onOpen?: () => void }) {
  const status = game.period ? `${game.period > 4 ? `OT${game.period - 4}` : `Q${game.period}`} · ${game.clock ?? "Live"}` : "Live now";
  return <section className="game-card"><div className="game-card-header"><div><p className="overline light">LIVE NOW</p><span className="game-status"><i /> {status}</span></div></div><div className="matchup"><div className="team-score"><TeamMark short={game.awayShort} color={game.awayColor} imageUrl={game.awayImageUrl} /><strong>{game.awayScore ?? "—"}</strong><span>{game.away}</span></div><div className="score-divider">—</div><div className="team-score"><TeamMark short={game.homeShort} color={game.homeColor} imageUrl={game.homeImageUrl} /><strong>{game.homeScore ?? "—"}</strong><span>{game.home}</span></div></div><div className="game-card-footer"><span>{game.network} · {game.venue}</span>{onOpen ? <button onClick={onOpen}>Open game center <span>↗</span></button> : <span>Live provider data</span>}</div></section>;
}

function GameCenterPanel({ center, loading, refreshing, catchUpLoading, error, onClose, onRetry, onCatchUp }: { center: GameCenterData | null; loading: boolean; refreshing: boolean; catchUpLoading: boolean; error: string; onClose: () => void; onRetry: () => void; onCatchUp: () => void }) {
  const timeZone = useContext(TimeZoneContext);
  if (loading && !center) return <section className="game-center-panel game-center-loading"><span className="live-loader" /><strong>Opening game center…</strong><small>Loading the latest score and box score.</small></section>;
  if (!center) return <section className="game-center-panel game-center-loading"><strong>Could not open this game.</strong><small>{error || "The game center is temporarily unavailable."}</small><button onClick={onRetry}>Try again</button></section>;

  const { game } = center;
  const statusLabel = game.status === "final" ? "Final" : game.status === "scheduled" ? `${dateKeyInTimeZone(game.startsAt, game.date, timeZone)} · ${formatTipTime(game.startsAt, game.time, timeZone, game.date)}` : `${game.period && game.period > 4 ? `OT${game.period - 4}` : `Q${game.period ?? "—"}`} · ${game.clock ?? "Live"}`;
  const sourceLabel = center.source === "mock-repository" ? "Demo game data" : `${center.source} game data`;

  return <section className="game-center-panel" aria-label={`${game.away.name} at ${game.home.name} game center`}>
    <div className="game-center-top"><div><p className="overline">SELECTED GAME</p><h2>{game.away.short} at {game.home.short}</h2></div><div className="game-center-actions"><span className={refreshing ? "refresh-state active" : "refresh-state"}>{refreshing ? "Updating…" : game.status === "live" ? "Auto-updates every 30 sec" : sourceLabel}</span><button className="game-center-catchup" onClick={onCatchUp} disabled={catchUpLoading || game.status === "scheduled"}>{catchUpLoading ? "Building recap…" : "✦ Catch me up"}</button><button className="game-center-close" onClick={onClose} aria-label="Close game center">×</button></div></div>
    {error && <div className="game-center-warning">{error} Showing the most recent update.</div>}
    <div className="game-center-scoreboard"><div className="game-center-team"><TeamMark short={game.away.short} color={game.away.color} imageUrl={game.away.imageUrl} /><span><strong>{game.away.name}</strong><small>Away</small></span><b>{game.awayScore ?? "—"}</b></div><div className={game.status === "live" ? "center-game-status live" : "center-game-status"}><i />{statusLabel}</div><div className="game-center-team home"><b>{game.homeScore ?? "—"}</b><span><strong>{game.home.name}</strong><small>Home</small></span><TeamMark short={game.home.short} color={game.home.color} imageUrl={game.home.imageUrl} /></div></div>
    <div className="game-center-meta"><span>{game.network}</span><span>{game.venue}</span><span>Updated {formatRelativeTime(center.updatedAt)}</span></div>
  </section>;
}

function ArticleDetailView({ article, loading, error, saved, saving, backLabel, teams, players, onBack, onRetry, onToggleSave, onOpenTeam, onOpenPlayer }: { article: NewsArticleData | null; loading: boolean; error: string; saved: boolean; saving: boolean; backLabel: string; teams: Team[]; players: Player[]; onBack: () => void; onRetry: () => void; onToggleSave: () => void; onOpenTeam: (teamId: string) => void; onOpenPlayer: (playerId: string) => void }) {
  if (loading && !article) return <><div className="page-heading article-heading"><button className="profile-back" onClick={onBack}>← {backLabel}</button><p className="overline">STORY</p><h1>Loading story…</h1></div><section className="player-profile-state"><span className="live-loader" /><strong>Opening the latest version</strong><small>Loading article details and related NBA context.</small></section></>;
  if (!article) return <><div className="page-heading article-heading"><button className="profile-back" onClick={onBack}>← {backLabel}</button><p className="overline">STORY</p><h1>Story unavailable</h1></div><section className="player-profile-state"><strong>Could not load this story.</strong><small>{error || "This article is no longer available in the current news feed."}</small><button onClick={onRetry}>Try again</button></section></>;

  const externalUrl = safeExternalUrl(article.url);
  const relatedTeams = teams.filter((team) => article.teamIds.includes(team.id));
  const relatedPlayers = players.filter((player) => article.playerIds.includes(player.id));
  return <div className="article-page"><div className="article-heading"><button className="profile-back" onClick={onBack}>← {backLabel}</button></div><article className="article-detail">
    <div className="article-kicker"><span>{article.source}</span><i />{formatRelativeTime(article.publishedAt)}</div>
    <h1>{article.title}</h1>
    <div className="article-tags">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    <p className="article-summary">{article.summary}</p>
    <p className="article-context">Sports Watch keeps the publisher&apos;s concise summary here so you can understand why the story matters before deciding whether to open the original coverage.</p>
    <div className="article-actions"><button className={saved ? "article-save saved" : "article-save"} disabled={saving} onClick={onToggleSave}>{saving ? "Saving…" : saved ? "✓ Saved" : "＋ Save story"}</button>{externalUrl ? <a href={externalUrl} target="_blank" rel="noreferrer">Read at {article.source} <span>↗</span></a> : <span className="article-demo-note">Full article link unavailable in demo data</span>}</div>{error && <p className="preference-status error">{error}</p>}
  </article>
    {(relatedTeams.length > 0 || relatedPlayers.length > 0) && <section className="article-related"><div className="section-heading"><div><p className="overline">PERSONALIZED CONTEXT</p><h2>People and teams in this story</h2></div></div><div className="article-related-list">{relatedTeams.map((team) => <button key={team.id} onClick={() => onOpenTeam(team.id)}><TeamMark short={team.short} color={team.color} imageUrl={team.imageUrl} /><span><strong>{team.name}</strong><small>{team.record} record</small></span><b>Team profile →</b></button>)}{relatedPlayers.map((player) => <button key={player.id} onClick={() => onOpenPlayer(player.id)}><PlayerAvatar player={player} className="preference-avatar" /><span><strong>{player.name}</strong><small>{player.teamName} · {player.position}</small></span><b>Player profile →</b></button>)}</div></section>}
  </div>;
}

function SavedStoriesView({ articles, savingArticleId, error, onOpen, onRemove }: { articles: SavedArticleData[]; savingArticleId: string | null; error: string; onOpen: (articleId: string) => void; onRemove: (articleId: string) => void }) {
  return <><div className="page-heading"><p className="overline">YOUR LIBRARY</p><h1>Saved stories</h1><p className="subhead">Keep important NBA coverage close, even after the live feed changes.</p>{error && <p className="preference-status error">{error}</p>}</div><section className="saved-stories-panel"><div className="section-heading"><div><h2>Articles</h2><p className="panel-copy">Saved independently for this account.</p></div><span className="count-badge">{articles.length} saved</span></div>{articles.length > 0 ? <div className="saved-story-list">{articles.map((article) => <article key={article.id}><button className="saved-story-main" onClick={() => onOpen(article.id)}><span className="saved-story-source">{article.source} · Saved {formatRelativeTime(article.savedAt)}</span><strong>{article.title}</strong><p>{article.summary}</p><span className="saved-story-tags">{article.tags.slice(0, 3).join(" · ")}</span></button><button className="saved-story-remove" disabled={savingArticleId === article.id} onClick={() => onRemove(article.id)}>{savingArticleId === article.id ? "Removing…" : "Remove"}</button></article>)}</div> : <div className="saved-stories-empty"><span>◇</span><strong>No saved stories yet</strong><p>Open a story from your feed or a team profile, then choose “Save story.”</p></div>}</section></>;
}

function TeamProfileView({ profile, loading, error, isFollowed, onBack, onRetry, onToggleFollow, onOpenPlayer, onOpenGame, onOpenArticle }: { profile: TeamProfileData | null; loading: boolean; error: string; isFollowed: boolean; onBack: () => void; onRetry: () => void; onToggleFollow: () => void; onOpenPlayer: (playerId: string) => void; onOpenGame: (gameId: string) => void; onOpenArticle: (articleId: string) => void }) {
  const timeZone = useContext(TimeZoneContext);
  if (loading && !profile) return <><div className="page-heading team-profile-heading"><button className="profile-back" onClick={onBack}>← My teams</button><p className="overline">TEAM PROFILE</p><h1>Loading team…</h1></div><section className="player-profile-state"><span className="live-loader" /><strong>Loading team overview</strong><small>Collecting season stats, roster, games, and news.</small></section></>;
  if (!profile) return <><div className="page-heading team-profile-heading"><button className="profile-back" onClick={onBack}>← My teams</button><p className="overline">TEAM PROFILE</p><h1>Team unavailable</h1></div><section className="player-profile-state"><strong>Could not load this team.</strong><small>{error || "Team information is temporarily unavailable."}</small><button onClick={onRetry}>Try again</button></section></>;

  const pointDifferential = Number((profile.stats.pointsPerGame - profile.stats.pointsAllowedPerGame).toFixed(1));
  const rankLabel = (rank: number, scope = "NBA") => rank > 0 ? `#${rank} ${scope}` : "Rank unavailable";
  const conferenceName = profile.standings.find((standing) => standing.teamId === profile.team.id)?.conference ?? "Conference";
  const standingsByConference = (["Eastern", "Western"] as const).map((conference) => ({ conference, rows: profile.standings.filter((standing) => standing.conference === conference) }));
  const sourceLabel = profile.source === "mock-repository" ? "Demo team data" : profile.source;
  const resultFor = (game: ApiGame) => {
    const isHome = game.home.id === profile.team.id;
    const teamScore = isHome ? game.homeScore ?? 0 : game.awayScore ?? 0;
    const opponentScore = isHome ? game.awayScore ?? 0 : game.homeScore ?? 0;
    return { isHome, opponent: isHome ? game.away : game.home, teamScore, opponentScore, result: teamScore >= opponentScore ? "W" : "L" };
  };

  return <div className="team-profile-page"><div className="team-profile-heading"><button className="profile-back" onClick={onBack}>← My teams</button></div>
    <section className="team-profile-hero"><TeamMark short={profile.team.short} color={profile.team.color} imageUrl={profile.team.imageUrl} /><div><p className="overline">{profile.seasonLabel} SEASON</p><h1>{profile.team.name}</h1><p>{profile.stats.wins}–{profile.stats.losses} · #{profile.stats.conferenceRank} in conference</p></div><button className={isFollowed ? "profile-follow following" : "profile-follow"} onClick={onToggleFollow}>{isFollowed ? "✓ Following" : "+ Follow team"}</button></section>
    <section className="team-metric-strip"><div><strong>{profile.stats.wins}–{profile.stats.losses}</strong><span>Record</span><small>{rankLabel(profile.rankings.record)}</small></div><div><strong>#{profile.stats.conferenceRank}</strong><span>Conference</span><small>{rankLabel(profile.rankings.conference, conferenceName)}</small></div><div><strong>{profile.stats.pointsPerGame}</strong><span>Points per game</span><small>{rankLabel(profile.rankings.pointsPerGame)}</small></div><div><strong>{profile.stats.pointsAllowedPerGame}</strong><span>Points allowed</span><small>{rankLabel(profile.rankings.pointsAllowedPerGame)}</small></div><div><strong className={pointDifferential >= 0 ? "positive" : "negative"}>{pointDifferential > 0 ? "+" : ""}{pointDifferential}</strong><span>Point differential</span><small>{rankLabel(profile.rankings.pointDifferential)}</small></div></section>

    <section className="team-profile-panel team-standings-panel"><div className="section-heading"><div><p className="overline">LEAGUE TABLE</p><h2>{profile.standingsSeasonLabel} standings</h2><p className="panel-copy">{profile.standingsUsesPreviousSeason ? "The current regular season has not started, so last season is shown." : "Current regular-season conference standings."}</p></div><span className="count-badge">{profile.standingsUsesPreviousSeason ? "Previous season" : "Current season"}</span></div><div className="standings-conferences">{standingsByConference.map(({ conference, rows }) => <div className="conference-standings" key={conference}><h3>{conference} Conference</h3><div className="standings-header"><span>Rank</span><span>Team</span><span>W</span><span>L</span><span>Diff</span></div><div className="standings-scroll">{rows.map((standing) => <div className={standing.teamId === profile.team.id ? "standings-row selected" : "standings-row"} key={standing.teamId}><b>{standing.conferenceRank}</b><span><TeamMark short={standing.teamShort} color={standing.color} imageUrl={standing.imageUrl} /><strong>{standing.teamName}</strong></span><em>{standing.wins}</em><em>{standing.losses}</em><em className={standing.pointDifferential >= 0 ? "positive" : "negative"}>{standing.pointDifferential > 0 ? "+" : ""}{standing.pointDifferential}</em></div>)}</div></div>)}</div></section>

    <div className="team-profile-grid"><section className="team-profile-panel roster-panel"><div className="section-heading"><div><p className="overline">PLAYERS TO KNOW</p><h2>Roster</h2><p className="panel-copy">Open any player for season, career, and last-10 statistics.</p></div><span className="count-badge">{profile.roster.length} players</span></div>{profile.roster.length > 0 ? <div className="team-profile-scroll" tabIndex={0} aria-label={`${profile.team.name} roster`}><div className="team-roster-list">{profile.roster.map((player) => <button key={player.id} onClick={() => onOpenPlayer(player.id)}><PlayerAvatar player={player} className="preference-avatar" /><span><strong>{player.name}</strong><small>{player.position}</small></span><b>→</b></button>)}</div></div> : <div className="profile-empty">No catalog players are available for this roster yet.</div>}</section>
      <section className="team-profile-panel team-news-panel"><div className="section-heading"><div><p className="overline">LATEST COVERAGE</p><h2>Team news</h2></div><span className="count-badge">{profile.articles.length} stories</span></div>{profile.articles.length > 0 ? <div className="team-profile-scroll" tabIndex={0} aria-label={`${profile.team.name} news`}><div className="team-news-list">{profile.articles.map((article) => <button key={article.id} onClick={() => onOpenArticle(article.id)}><small>{article.source} · {formatRelativeTime(article.publishedAt)}</small><strong>{article.title}</strong><p>{article.summary}</p><b>Read story →</b></button>)}</div></div> : <div className="profile-empty">No current stories are available for this team.</div>}</section></div>

    <section className="team-profile-panel team-games-panel"><div className="section-heading"><div><p className="overline">SCHEDULE</p><h2>Upcoming games</h2></div><span className="count-badge">Next {profile.upcomingGames.length}</span></div>{profile.upcomingGames.length > 0 ? <div className="team-game-list">{profile.upcomingGames.map((game) => { const isHome = game.home.id === profile.team.id; const opponent = isHome ? game.away : game.home; return <button key={game.id} onClick={() => onOpenGame(game.id)}><span className="team-game-date">{new Date(`${dateKeyInTimeZone(game.startsAt, game.date, timeZone)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><TeamMark short={opponent.short} color={opponent.color} imageUrl={opponent.imageUrl} /><span><strong>{isHome ? "vs" : "@"} {opponent.name}</strong><small>{game.status === "live" ? `${game.period ? `Q${game.period}` : "Live"} · ${game.clock ?? "Live"}` : `${formatTipTime(game.startsAt, game.time, timeZone, game.date)} · ${game.network}`}</small></span><b>{game.status === "live" ? "Open live →" : "Game center →"}</b></button>; })}</div> : <div className="profile-empty">No upcoming games are available.</div>}</section>

    <section className="team-profile-panel team-games-panel"><div className="section-heading"><div><p className="overline">RESULTS</p><h2>Recent games</h2></div><span className="count-badge">Last {profile.recentGames.length}</span></div>{profile.recentGames.length > 0 ? <div className="team-game-list">{profile.recentGames.map((game) => { const result = resultFor(game); return <button key={game.id} onClick={() => onOpenGame(game.id)}><span className="team-game-date">{new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><TeamMark short={result.opponent.short} color={result.opponent.color} imageUrl={result.opponent.imageUrl} /><span><strong>{result.isHome ? "vs" : "@"} {result.opponent.name}</strong><small>{game.network} · Final</small></span><span className={result.result === "W" ? "team-game-result win" : "team-game-result loss"}>{result.result} {result.teamScore}–{result.opponentScore}</span></button>; })}</div> : <div className="profile-empty">No recent final scores are available.</div>}<div className="provider-note"><span className="status-dot" />{sourceLabel} · Updated {formatRelativeTime(profile.updatedAt)}</div></section>
  </div>;
}

function PlayerProfileView({ profile, loading, error, isFollowed, onBack, onRetry, onToggleFollow, backLabel, onOpenLeaderboard }: { onOpenLeaderboard: (metric: LeaderboardMetric) => void; backLabel: string; profile: PlayerProfileData | null; loading: boolean; error: string; isFollowed: boolean; onBack: () => void; onRetry: () => void; onToggleFollow: () => void }) {
  if (loading && !profile) return <><div className="page-heading player-profile-heading"><button className="profile-back" onClick={onBack}>← {backLabel}</button><p className="overline">PLAYER PROFILE</p><h1>Loading player…</h1></div><section className="player-profile-state"><span className="live-loader" /><strong>Loading season and career statistics</strong><small>Collecting the latest player data and game logs.</small></section></>;
  if (!profile) return <><div className="page-heading player-profile-heading"><button className="profile-back" onClick={onBack}>← {backLabel}</button><p className="overline">PLAYER PROFILE</p><h1>Player unavailable</h1></div><section className="player-profile-state"><strong>Could not load this profile.</strong><small>{error || "Player statistics are temporarily unavailable."}</small><button onClick={onRetry}>Try again</button></section></>;

  const season = profile.currentSeason;
  const career = profile.career;
  const seasonRankings = profile.currentSeasonRankings;
  const seasonMetrics = season ? leaderboardMetrics.map(([key, label]) => ({
    key, label, value: season[key] === undefined ? "—" : `${season[key]}${key.endsWith("Percentage") ? "%" : ""}`, rank: seasonRankings?.[key],
  })) : [];
  const careerMetrics = career ? [["PPG", career.pointsPerGame], ["RPG", career.reboundsPerGame], ["APG", career.assistsPerGame], ["Games", career.gamesPlayed], ["FG%", `${career.fieldGoalPercentage}%`], ["3P%", `${career.threePointPercentage}%`]] : [];
  const draft = profile.bio.draftYear ? `${profile.bio.draftYear}${profile.bio.draftRound ? ` · Round ${profile.bio.draftRound}` : ""}${profile.bio.draftNumber ? ` · Pick ${profile.bio.draftNumber}` : ""}` : "—";
  const sourceLabel = profile.source === "mock-repository" ? "Demo profile data" : `${profile.source} player data`;

  return <div className="player-profile-page">
    <div className="player-profile-heading"><button className="profile-back" onClick={onBack}>← {backLabel}</button></div>
    <section className="player-profile-hero"><PlayerAvatar player={profile.player} className="player-profile-avatar" /><div className="player-profile-title"><p className="overline">{profile.player.position}{profile.bio.jerseyNumber ? ` · #${profile.bio.jerseyNumber}` : ""}</p><h1>{profile.player.name}</h1><p>{profile.player.teamName}</p></div><button className={isFollowed ? "profile-follow following" : "profile-follow"} onClick={onToggleFollow}>{isFollowed ? "✓ Following" : "+ Follow player"}</button></section>
    <div className="player-bio-strip"><div><span>Height</span><strong>{profile.bio.height ?? "—"}</strong></div><div><span>Weight</span><strong>{profile.bio.weight ? `${profile.bio.weight} lb` : "—"}</strong></div><div><span>Country</span><strong>{profile.bio.country ?? "—"}</strong></div><div><span>College</span><strong>{profile.bio.college ?? "—"}</strong></div><div><span>Draft</span><strong>{draft}</strong></div></div>

    <div className="player-stat-panels"><section className="player-stat-panel"><div className="section-heading"><div><p className="overline">CURRENT FORM</p><h2>{season?.seasonLabel ?? "Current season"}</h2></div><span className="count-badge">{season ? `${season.gamesPlayed} GP` : "No data"}</span></div>{season ? <div className="player-stat-grid">{seasonMetrics.map(({ key, label, value, rank }) => <button className="player-stat-link" key={key} onClick={() => onOpenLeaderboard(key)} aria-label={`View ${label} leaderboard`}><strong>{value}</strong><span>{label}</span><small>{rank ? `#${rank} NBA` : "View leaderboard"}</small></button>)}</div> : <div className="profile-empty">Current-season averages are not available yet.</div>}</section>
      <section className="player-stat-panel"><div className="section-heading"><div><p className="overline">REGULAR SEASON</p><h2>Career averages</h2></div><span className="count-badge">{career ? `${career.seasonsPlayed} seasons` : "No data"}</span></div>{career ? <div className="player-stat-grid">{careerMetrics.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div> : <div className="profile-empty">Career averages are not available for this player.</div>}</section></div>

    <section className="player-data-panel"><div className="section-heading"><div><p className="overline">RECENT FORM</p><h2>Last 10 games</h2><p className="panel-copy">Latest completed regular-season box scores, including the prior season when needed.</p></div><span className="count-badge">{profile.lastTenGames.length} games</span></div>{profile.lastTenGames.length > 0 ? <div className="player-table-wrap"><table className="player-stats-table"><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>3PT</th><th>FT</th><th>+/-</th></tr></thead><tbody>{profile.lastTenGames.map((game) => <tr key={game.id}><td>{new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td><strong>{game.homeAway === "home" ? "vs" : "@"} {game.opponentShort}</strong></td><td><span className={game.result === "W" ? "game-result win" : "game-result loss"}>{game.result}</span> {game.score}</td><td>{game.minutes}</td><td><strong>{game.points}</strong></td><td>{game.rebounds}</td><td>{game.assists}</td><td>{game.steals}</td><td>{game.blocks}</td><td>{game.turnovers}</td><td>{game.fieldGoals}</td><td>{game.threePointers}</td><td>{game.freeThrows ?? "—"}</td><td className={game.plusMinus >= 0 ? "positive" : "negative"}>{game.plusMinus > 0 ? "+" : ""}{game.plusMinus}</td></tr>)}</tbody></table></div> : <div className="profile-empty table-empty">No completed regular-season game logs are available.</div>}</section>

    <section className="player-data-panel"><div className="section-heading"><div><p className="overline">CAREER</p><h2>Season by season</h2><p className="panel-copy">Regular-season averages, weighted by games played in the career summary above.</p></div><span className="count-badge">{profile.seasons.length} seasons</span></div>{profile.seasons.length > 0 ? <div className="player-table-wrap"><table className="player-stats-table season-history"><thead><tr><th>Season</th><th>Team</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG%</th><th>3P%</th><th>FT%</th></tr></thead><tbody>{profile.seasons.map((item) => <tr key={item.season}><td><strong>{item.seasonLabel}</strong></td><td>{item.teamName}</td><td>{item.gamesPlayed}</td><td>{item.pointsPerGame}</td><td>{item.reboundsPerGame}</td><td>{item.assistsPerGame}</td><td>{item.stealsPerGame}</td><td>{item.blocksPerGame}</td><td>{item.turnoversPerGame}</td><td>{item.fieldGoalPercentage}</td><td>{item.threePointPercentage}</td><td>{item.freeThrowPercentage ?? "—"}</td></tr>)}</tbody></table></div> : <div className="profile-empty table-empty">Season history is unavailable.</div>}<div className="provider-note"><span className="status-dot" />{sourceLabel} · Updated {formatRelativeTime(profile.updatedAt)}</div></section>
  </div>;
}

function SettingsView({ account, authenticated, teams, players, preferences, savingPreferences, theme, section, onSectionChange, onThemeChange, onAccountUpdated, onSessionEnded, onToggleTeam, onTogglePlayer, onSignIn }: { account: Account; authenticated: boolean; teams: Team[]; players: Player[]; preferences: Preferences; savingPreferences: boolean; theme: ThemeMode; section: SettingsSection; onSectionChange: (section: SettingsSection) => void; onThemeChange: (theme: ThemeMode) => void; onAccountUpdated: (account: Account) => void; onSessionEnded: () => void; onToggleTeam: (teamId: string) => void; onTogglePlayer: (playerId: string) => void; onSignIn: () => void }) {
  const [teamQuery, setTeamQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountStatus, setAccountStatus] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const visibleTeams = searchTeams(teams, teamQuery).slice(0, teamQuery.trim() ? 30 : 18);
  const followedPlayerSet = new Set(preferences.followedPlayerIds);
  const visiblePlayers = playerQuery.trim()
    ? searchPlayers(players, playerQuery).slice(0, 30)
    : [...players.filter((player) => followedPlayerSet.has(player.id)), ...players.filter((player) => !followedPlayerSet.has(player.id)).slice(0, 18)];
  const timeZoneOptions = commonTimeZones.some(([value]) => value === account.timezone)
    ? commonTimeZones
    : [[account.timezone, account.timezone], ...commonTimeZones] as ReadonlyArray<readonly [string, string]>;

  const saveAccount = async (body: Record<string, string>, successMessage: string, form?: HTMLFormElement) => {
    setAccountSaving(true);
    setAccountStatus("");
    try {
      const payload = await fetchJson<{ data: Account; meta: { verificationRequired: boolean; signedOut?: boolean; previewUrl?: string } }>("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onAccountUpdated(payload.data);
      setAccountStatus(payload.meta.verificationRequired ? `${successMessage} Check your email to confirm the change.` : successMessage);
      setVerificationUrl(payload.meta.previewUrl ?? "");
      form?.reset();
      if (payload.meta.signedOut) onSessionEnded();
    } catch (saveError) {
      setAccountStatus(saveError instanceof Error ? saveError.message : "Could not update your account.");
    } finally { setAccountSaving(false); }
  };

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void saveAccount({ displayName: String(data.get("displayName") ?? ""), timezone: String(data.get("timezone") ?? "") }, "Account details updated.");
  };
  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void saveAccount({ currentPassword: String(data.get("currentPassword") ?? ""), newPassword: String(data.get("newPassword") ?? "") }, "Password updated.", form);
  };

  return <div className="settings-page"><div className="page-heading"><p className="overline">PERSONALIZE SPORTS WATCH</p><h1>Settings</h1><p className="subhead">Manage your account, favorites, and display preferences in one place.</p></div><div className="settings-shell"><nav className="settings-menu" aria-label="Settings sections">{([['account', 'Account', 'Name, timezone, and password'], ['preferences', 'Preferences', 'Teams and players'], ['appearance', 'Appearance', 'Light and dark mode']] as const).map(([key, label, detail]) => <button className={section === key ? "active" : ""} key={key} onClick={() => { onSectionChange(key); setAccountStatus(""); }}><span><strong>{label}</strong><small>{detail}</small></span><b>›</b></button>)}</nav><section className="settings-content">
    {section === "account" ? <><div className="settings-section-heading"><p className="overline">ACCOUNT SETTINGS</p><h2>Your account</h2><p>Update the details used across Sports Watch.</p></div>{authenticated ? <div className="account-settings-forms"><form className="settings-form" onSubmit={submitProfile}><h3>Account details</h3><label>Display name<input name="displayName" defaultValue={account.displayName} minLength={2} maxLength={50} required /></label><label>Email <small className={account.emailVerified ? "email-state verified" : "email-state pending"}>{account.emailVerified ? "Verified" : "Verification pending"}</small><input value={account.email} disabled /></label><label>Game time timezone<select name="timezone" defaultValue={account.timezone}>{timeZoneOptions.map(([value, label]) => <option value={value} key={value}>{label} ({value})</option>)}</select></label><button disabled={accountSaving}>Save profile</button></form><form className="settings-form password-form" onSubmit={submitPassword}><h3>Change password</h3><p className="password-note">Changing your password requires email confirmation before your next sign-in.</p><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label><button disabled={accountSaving}>Update password</button></form>{accountStatus && <p className="settings-status" role="status">{accountStatus}{verificationUrl && <a href={verificationUrl}> Open local verification link</a>}</p>}</div> : <div className="settings-signin"><strong>Sign in to edit account details</strong><p>Your preferences can still be explored in demo mode.</p><button onClick={onSignIn}>Sign in</button></div>}</> : section === "preferences" ? <><div className="settings-section-heading"><p className="overline">PREFERENCES</p><h2>Shape your feed</h2><p>Tap a compact bubble to follow or unfollow it. No profile images, just quick choices.</p></div><div className="compact-preference-section"><div className="compact-preference-title"><h3>Teams</h3><span>{preferences.followedTeamIds.length} followed</span></div><EntitySearch value={teamQuery} onChange={setTeamQuery} label="Search teams in settings" placeholder="Search teams" /><div className="preference-bubbles">{visibleTeams.map((team) => { const selected = preferences.followedTeamIds.includes(team.id); return <button className={selected ? "preference-bubble selected" : "preference-bubble"} key={team.id} disabled={savingPreferences} onClick={() => onToggleTeam(team.id)}><span>{team.name}</span><b>{selected ? "✓" : "+"}</b></button>; })}</div></div><div className="compact-preference-section"><div className="compact-preference-title"><h3>Players</h3><span>{preferences.followedPlayerIds.length} followed</span></div><EntitySearch value={playerQuery} onChange={setPlayerQuery} label="Search players in settings" placeholder="Search players" /><div className="preference-bubbles">{visiblePlayers.map((player) => { const selected = preferences.followedPlayerIds.includes(player.id); return <button className={selected ? "preference-bubble selected" : "preference-bubble"} key={player.id} disabled={savingPreferences} onClick={() => onTogglePlayer(player.id)}><span>{player.name}</span><b>{selected ? "✓" : "+"}</b></button>; })}</div></div></> : <><div className="settings-section-heading"><p className="overline">APPEARANCE</p><h2>Choose a theme</h2><p>Your selection is saved on this device.</p></div><div className="theme-options">{([['dark', 'Dark', 'Deep surfaces with your chosen accent'], ['light', 'Light', 'Light surfaces with your chosen accent']] as const).map(([mode, label, detail]) => <button className={theme === mode ? "theme-option selected" : "theme-option"} key={mode} onClick={() => onThemeChange(mode)}><span className={`theme-preview ${mode}`}><i /><i /><i /></span><span><strong>{label}</strong><small>{detail}</small></span><b>{theme === mode ? "✓" : ""}</b></button>)}</div><AppearanceColors theme={theme} /></>}
  </section></div></div>;
}

function CatchUpModal({ brief, onClose, onFeedback, onOpenGame }: { brief: CatchUpBrief; onClose: () => void; onFeedback: () => Promise<void>; onOpenGame: (id: string) => void }) {
  const [slide, setSlide] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [assistantMeta, setAssistantMeta] = useState("");
  const [citations, setCitations] = useState<CatchUpCitationData[]>([]);
  const [asking, setAsking] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const moment = brief.moments[slide];

  const moveTo = (next: number) => {
    setSlide(Math.min(Math.max(next, 0), Math.max(brief.moments.length - 1, 0)));
    setQuestion("");
    setAnswer("");
    setAssistantMeta("");
    setCitations([]);
    setAssistantError("");
  };
  const ask = async (prompt: string) => {
    if (!moment || !prompt.trim()) return;
    setAsking(true);
    setAssistantError("");
    setAnswer("");
    setAssistantMeta("");
    setCitations([]);
    try {
      const payload = await fetchJson<{ data: { answer: string; citations: CatchUpCitationData[]; provider: "groq" | "local"; webSearchUsed: boolean; fallbackReason?: "not-configured" | "provider-unavailable" } }>("/api/catch-up/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, momentId: moment.id, momentSource: moment.source, gameId: moment.gameId ?? brief.game?.id }),
      });
      setAnswer(payload.data.answer);
      setCitations(payload.data.citations);
      setAssistantMeta(payload.data.provider === "groq" ? `Groq AI${payload.data.webSearchUsed ? " · searched current sources" : " · recap context only"}` : payload.data.fallbackReason === "provider-unavailable" ? "Local recap · Groq temporarily unavailable" : "Local recap · add a Groq key for broader answers");
    } catch (askError) {
      setAssistantError(askError instanceof Error ? askError.message : "The assistant is unavailable.");
    } finally { setAsking(false); }
  };
  const showingAnswer = asking || Boolean(answer);
  const backToStory = () => {
    setAnswer("");
    setAssistantMeta("");
    setCitations([]);
    setAssistantError("");
  };

  return <div className="modal-backdrop" onClick={onClose}><section className="catch-up-modal" role="dialog" aria-modal="true" aria-labelledby="catch-up-title" onClick={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Close catch-up">×</button>
    <div className="catch-up-header"><p className="overline">YOUR {brief.readTimeMinutes}-MINUTE CATCH-UP</p><h2 id="catch-up-title">{brief.title}</h2><p className="modal-lede">{brief.lede}</p><div className="catch-up-source"><i />{brief.source === "box-score" ? "Built from game scores and box-score highlights" : "Built from the latest NBA coverage"}</div></div>
    <div className="catch-up-workspace"><div className="catch-up-reader">
      {showingAnswer ? <article className="catch-up-slide assistant-answer-slide" aria-live="polite"><button className="assistant-answer-back" onClick={backToStory} disabled={asking}>← Back to story {slide + 1}</button>{asking ? <div className="assistant-answer-loading"><span className="live-loader" /><strong>Sports Watch is thinking…</strong><small>Building an answer from this story&apos;s context.</small></div> : <><p className="slide-reason">SPORTS WATCH ASSISTANT</p><h3>Answer</h3><FormattedAssistantAnswer value={answer} /><small className="assistant-answer-meta">{assistantMeta}</small>{citations.length > 0 && <div className="assistant-sources"><b>Sources</b><ol>{citations.map((citation, index) => { const url = safeExternalUrl(citation.url); return url ? <li key={url}><a href={url} target="_blank" rel="noreferrer"><span>{index + 1}</span>{citation.title}</a></li> : null; })}</ol></div>}</>}</article> : moment ? <article className="catch-up-slide"><div className="slide-progress"><span>STORY {slide + 1} OF {brief.moments.length}</span><div>{brief.moments.map((item, index) => <button key={item.id} className={index === slide ? "active" : ""} onClick={() => moveTo(index)} aria-label={`Open story ${index + 1}`} />)}</div></div>{moment.source === "news" && <NewsInterestMenu articleId={moment.id} onSaved={onFeedback} />}<p className="slide-reason">{moment.reason}</p>{moment.source === "box-score" && (moment.gameId || brief.game?.id) ? <GameCatchUpStory moment={moment} gameId={moment.gameId || brief.game!.id} onOpen={onOpenGame} /> : <><h3>{moment.title}</h3>{moment.context && <p className="slide-context">{moment.context}</p>}<p className="slide-detail">{moment.detail}</p></>}<div className="slide-importance"><span>Importance</span><b>{moment.importanceScore}/100</b></div></article> : <div className="catch-up-empty">There are no significant updates yet.</div>}
      {!showingAnswer && <div className="catch-up-navigation"><button onClick={() => moveTo(slide - 1)} disabled={slide === 0}>← Previous</button><button onClick={slide === brief.moments.length - 1 ? onClose : () => moveTo(slide + 1)}>{slide === brief.moments.length - 1 ? "Back to my feed" : "Next story →"}</button></div>}
    </div><aside className="catch-up-assistant"><p className="overline">ASK ABOUT THIS STORY</p><h3>Sports Watch assistant</h3><p>Summaries use the recap. Freshness questions search trusted NBA sources and include citations.</p><div className="assistant-prompts">{["Summarize this in one sentence", "Why does this matter?", "What should I watch next?", "Find the latest update"].map((prompt) => <button key={prompt} disabled={!moment || asking} onClick={() => { setQuestion(prompt); void ask(prompt); }}>{prompt}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void ask(question); }}><label htmlFor="catch-up-question">Your question</label><textarea id="catch-up-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Ask about this update…" /><button disabled={!question.trim() || !moment || asking}>{asking ? "Thinking…" : "Ask assistant"}</button></form>{assistantError && <p className="assistant-error" role="alert">{assistantError}</p>}</aside></div>
  </section></div>;
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ message: string; previewUrl?: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = mode === "register"
      ? { displayName: form.get("displayName"), email: form.get("email"), password: form.get("password"), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : mode === "forgot" ? { email: form.get("email") } : { email: form.get("email"), password: form.get("password") };
    try {
      const endpoint = mode === "register" ? "register" : mode === "forgot" ? "forgot-password" : "login";
      const payload = await fetchJson<{ meta?: { verificationRequired?: boolean; previewUrl?: string; message?: string } }>(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (mode === "forgot") {
        setSuccess({ message: payload.meta?.message ?? "If an account exists for that email, a password reset link has been sent.", previewUrl: payload.meta?.previewUrl });
        setSubmitting(false);
      } else if (mode === "register" && payload.meta?.verificationRequired) {
        setSuccess({ message: "Account created. Check your email and open the verification link before signing in.", previewUrl: payload.meta.previewUrl });
        setSubmitting(false);
      } else window.location.reload();
    } catch (submitError) {
      if (submitError instanceof ApiRequestError && submitError.meta?.verificationRequired) {
        setSuccess({
          message: submitError.meta.accountCreated
            ? "Your account was created, but the verification message could not be delivered. Try signing in with the same password to generate a new verification link."
            : "Your account still needs email verification. Open the verification link before signing in.",
          previewUrl: submitError.meta.previewUrl,
        });
        setSubmitting(false);
        return;
      }
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
      setSubmitting(false);
    }
  };

  const changeMode = (nextMode: "login" | "register" | "forgot") => { setMode(nextMode); setError(""); setSuccess(null); };
  return <div className="modal-backdrop" onClick={onClose}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><div className="auth-brand"><span className="brand-dot" />Sports Watch</div><p className="overline">YOUR NBA, SAVED</p><h2 id="auth-title">{success ? "Check your email" : mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Reset your password"}</h2>{success ? <div className="auth-success" role="status"><span>✓</span><p>{success.message}</p>{success.previewUrl && <a href={success.previewUrl}>{mode === "forgot" ? "Open local reset link" : "Open local verification link"}</a>}<button onClick={onClose}>Continue exploring</button></div> : <><p className="auth-copy">{mode === "login" ? "Sign in to load your teams, players, alerts, and personal feed." : mode === "register" ? "Save your favorites and get a personal NBA feed on every visit." : "Enter your account email and we’ll send you a secure, one-time reset link."}</p><form className="auth-form" onSubmit={submit}>{mode === "register" && <label>Display name<input name="displayName" autoComplete="name" minLength={2} maxLength={50} required placeholder="Isaac" /></label>}<label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>{mode !== "forgot" && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} required placeholder="At least 8 characters" /></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}<span>→</span></button></form><div className="auth-links">{mode === "login" && <button className="auth-switch" onClick={() => changeMode("forgot")}>Forgot password?</button>}<button className="auth-switch" onClick={() => changeMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "New to Sports Watch? Create an account" : mode === "register" ? "Already have an account? Sign in" : "Back to sign in"}</button></div><p className="auth-demo">You can close this window to keep exploring in shared demo mode.</p></>}</section></div>;
}

function ResetPasswordModal({ token, onClose, onComplete }: { token: string; onClose: () => void; onComplete: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return; }
    setSubmitting(true);
    try {
      await fetchJson("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      setComplete(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset failed.");
    } finally { setSubmitting(false); }
  };

  return <div className="modal-backdrop" onClick={onClose}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><div className="auth-brand"><span className="brand-dot" />Sports Watch</div><p className="overline">SECURE ACCOUNT RECOVERY</p><h2 id="reset-password-title">{complete ? "Password changed" : "Choose a new password"}</h2>{complete ? <div className="auth-success" role="status"><span>✓</span><p>Your password has been updated. For your security, existing sessions were signed out.</p><button onClick={onComplete}>Sign in with new password</button></div> : <><p className="auth-copy">Enter and confirm your new password. This reset link can only be used once.</p><form className="auth-form" onSubmit={submit}><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="At least 8 characters" /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="Enter it again" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={submitting}>{submitting ? "Changing password…" : "Change password"}<span>→</span></button></form></>}</section></div>;
}

function OnboardingModal({ teams, players, recommendedTeamIds, recommendedPlayerIds, initialPreferences }: { teams: Team[]; players: Player[]; recommendedTeamIds: string[]; recommendedPlayerIds: string[]; initialPreferences: Preferences }) {
  const [step, setStep] = useState(0);
  const [teamIds, setTeamIds] = useState<string[]>(initialPreferences.followedTeamIds);
  const [playerIds, setPlayerIds] = useState<string[]>(initialPreferences.followedPlayerIds);
  const [alerts, setAlerts] = useState(initialPreferences.alerts);
  const [teamSearch, setTeamSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const recommendedTeams = new Set(recommendedTeamIds);
  const recommendedPlayers = new Set(recommendedPlayerIds);
  const visibleOnboardingTeams = searchTeams(teams, teamSearch);
  const visibleOnboardingPlayers = searchPlayers(players, playerSearch);

  const complete = async (skip = false) => {
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followedTeamIds: skip ? [] : teamIds, followedPlayerIds: skip ? [] : playerIds, alerts }),
      });
      window.location.reload();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Could not save your setup.");
      setSaving(false);
    }
  };

  const toggleId = (id: string, current: string[], setCurrent: (ids: string[]) => void) => setCurrent(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const stepNames = ["Teams", "Players", "Alerts"];

  return <div className="modal-backdrop"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div className="onboarding-top"><div className="auth-brand"><span className="brand-dot" />Sports Watch</div><button className="onboarding-skip" disabled={saving} onClick={() => void complete(true)}>Skip setup</button></div><div className="onboarding-progress">{stepNames.map((name, index) => <div className={index === step ? "active" : index < step ? "complete" : ""} key={name}><span>{index < step ? "✓" : index + 1}</span><small>{name}</small></div>)}</div>{step === 0 ? <><p className="overline">STEP 1 OF 3</p><h2 id="onboarding-title">Choose your teams</h2><p className="auth-copy">Your choices shape game schedules, news, catch-ups, and alerts. You can change them anytime.</p><EntitySearch value={teamSearch} onChange={setTeamSearch} label="Search NBA teams" placeholder="Search teams by name or abbreviation" /><div className="onboarding-grid">{visibleOnboardingTeams.length > 0 ? visibleOnboardingTeams.map((team) => { const selected = teamIds.includes(team.id); return <button className={selected ? "onboarding-choice selected" : "onboarding-choice"} key={team.id} onClick={() => toggleId(team.id, teamIds, setTeamIds)}><TeamMark short={team.short} color={team.color} imageUrl={team.imageUrl} /><span><strong>{team.name}</strong><small>{recommendedTeams.has(team.id) ? "Popular pick" : team.record === "—" ? "NBA team" : `${team.record} record`}</small></span><b>{selected ? "✓" : "+"}</b></button>; }) : <div className="search-empty">No teams match “{teamSearch}”.</div>}</div></> : step === 1 ? <><p className="overline">STEP 2 OF 3</p><h2 id="onboarding-title">Choose your players</h2><p className="auth-copy">Follow players to prioritize performances, injuries, and important storylines.</p><EntitySearch value={playerSearch} onChange={setPlayerSearch} label="Search NBA players" placeholder="Search players by name, team, or position" /><div className="onboarding-grid">{visibleOnboardingPlayers.length > 0 ? visibleOnboardingPlayers.map((player) => { const selected = playerIds.includes(player.id); return <button className={selected ? "onboarding-choice selected" : "onboarding-choice"} key={player.id} onClick={() => toggleId(player.id, playerIds, setPlayerIds)}><PlayerAvatar player={player} className="preference-avatar" /><span><strong>{player.name}</strong><small>{recommendedPlayers.has(player.id) ? "Popular pick" : player.teamName}</small></span><b>{selected ? "✓" : "+"}</b></button>; }) : <div className="search-empty">No players match “{playerSearch}”.</div>}</div></> : <><p className="overline">STEP 3 OF 3</p><h2 id="onboarding-title">Choose your alerts</h2><p className="auth-copy">Start with the moments worth interrupting your day for.</p><div className="onboarding-alerts">{(Object.keys(alertLabels) as Array<keyof AlertPreferences>).map((key) => <button className={alerts[key] ? "onboarding-alert selected" : "onboarding-alert"} key={key} onClick={() => setAlerts((current) => ({ ...current, [key]: !current[key] }))}><span>{alertIcons[key]}</span><strong>{alertLabels[key]}</strong><b>{alerts[key] ? "On" : "Off"}</b></button>)}</div></>}{error && <p className="auth-error" role="alert">{error}</p>}<div className="onboarding-actions">{step > 0 ? <button className="onboarding-back" disabled={saving} onClick={() => setStep((current) => current - 1)}>← Back</button> : <span />}<div><small>{teamIds.length} teams · {playerIds.length} players</small><button className="auth-submit" disabled={saving} onClick={() => step < 2 ? setStep((current) => current + 1) : void complete()}>{saving ? "Saving…" : step < 2 ? "Continue" : "Finish setup"}<span>→</span></button></div></div></section></div>;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <main className="app-boot"><div className="brand"><span className="brand-dot" />Sports Watch</div><span className="live-loader" /><small>Loading your NBA…</small></main>;
  return <SportsWatchApp />;
}

function SportsWatchApp() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [schedule, setSchedule] = useState<Game[]>([]);
  const [liveSnapshot, setLiveSnapshot] = useState<ApiGame[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState("");
  const [teams, setTeams] = useState<Team[]>(defaultTeams);
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [account, setAccount] = useState<Account>({ id: "account-demo", displayName: "Alex Morgan", email: "", timezone: "America/Los_Angeles", createdAt: "", emailVerified: true });
  const [theme, setTheme] = useState<ThemeMode>(() => window.localStorage.getItem("sports-watch-theme") === "light" ? "light" : "dark");
  useAccentTheme(theme);
  const [authenticated, setAuthenticated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [passwordResetToken, setPasswordResetToken] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({ followedTeamIds: ["gsw"], followedPlayerIds: ["stephen-curry"], alerts: { gameStarting: true, closeGame: true, finalScore: true, standoutPerformance: false, injuryUpdate: true, leadChange: true, milestone: false } });
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryRecommendations>({ teams: [], players: [], games: [] });
  const [catchUpBrief, setCatchUpBrief] = useState<CatchUpBrief | null>(null);
  const [notifications, setNotifications] = useState<DeliveredAlert[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [personalizationLoading, setPersonalizationLoading] = useState(true);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedRefreshStatus, setFeedRefreshStatus] = useState("");
  const [lastFeedRefreshAt, setLastFeedRefreshAt] = useState(() => Date.now());
  const [feedFreshnessStatus, setFeedFreshnessStatus] = useState("");
  async function reloadNewsPreferences() {
    const [prefs, feed] = await Promise.all([
      fetchJson<{ data: Preferences }>("/api/preferences", { cache: "no-store" }),
      fetchJson<{ data: FeedItem[] }>("/api/feed", { cache: "no-store" }),
    ]);
    setPreferences(prefs.data);
    setFeedItems(newestFeedFirst(feed.data));
    // Preserve the selected game's context; refreshing news never triggers ingestion.
    const gameQuery = catchUpBrief?.game?.id ? `?gameId=${encodeURIComponent(catchUpBrief.game.id)}` : "";
    const recap = await fetchJson<{ data: CatchUpBrief }>(`/api/catch-up${gameQuery}`, { cache: "no-store" });
    setCatchUpBrief(recap.data);
  }

  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [activeNav, setActiveNav] = useState("Home");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("account");
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [catchUpLoading, setCatchUpLoading] = useState(true);
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>("pointsPerGame");
  const [leaderboardPlayerId, setLeaderboardPlayerId] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("day");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(12);
  const [calendarGames, setCalendarGames] = useState<Game[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSettledRange, setCalendarSettledRange] = useState("");
  const [scheduleLoadError, setScheduleLoadError] = useState("");
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const gamesRetryAt = useRef(0);
  const gamesFailures = useRef(0);
  const [teamRecords, setTeamRecords] = useState<{ season: number; records: Record<string, string> } | null>(null);
  const [teamRecordsLoading, setTeamRecordsLoading] = useState(true);
  const [teamRecordsStatus, setTeamRecordsStatus] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarRetry, setCalendarRetry] = useState(0);
  const [gameBackNav, setGameBackNav] = useState("Schedule");
  const [playerBackNav, setPlayerBackNav] = useState("My players");
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [scheduleTeam, setScheduleTeam] = useState("All teams");
  const [scheduleScope, setScheduleScope] = useState<GameFilterScope>("all");
  const [liveScope, setLiveScope] = useState<GameFilterScope>("all");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameCenter, setGameCenter] = useState<GameCenterData | null>(null);
  const [gameCenterLoading, setGameCenterLoading] = useState(false);
  const [gameCenterRefreshing, setGameCenterRefreshing] = useState(false);
  const [gameCenterError, setGameCenterError] = useState("");
  const [gameCenterRefreshKey, setGameCenterRefreshKey] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfileData | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [playerProfileError, setPlayerProfileError] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamProfile, setTeamProfile] = useState<TeamProfileData | null>(null);
  const [teamProfileLoading, setTeamProfileLoading] = useState(false);
  const [teamProfileError, setTeamProfileError] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<NewsArticleData | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState("");
  const [articleBackNav, setArticleBackNav] = useState("Home");
  const [savedArticles, setSavedArticles] = useState<SavedArticleData[]>([]);
  const [savingArticleId, setSavingArticleId] = useState<string | null>(null);
  const [savedArticlesError, setSavedArticlesError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("sports-watch-theme", theme);
  }, [theme]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("verification");
    const sessionStatus = url.searchParams.get("session");
    const resetToken = url.searchParams.get("reset-password")?.trim() ?? "";
    if (resetToken) setPasswordResetToken(resetToken);
    if (status === "account") setVerificationNotice("Email verified. Your Sports Watch account is ready.");
    else if (status === "password") setVerificationNotice("Password change confirmed. Your email is verified again.");
    else if (status === "invalid") setVerificationNotice("That verification link is invalid or has expired.");
    else if (sessionStatus === "password-changed") setVerificationNotice("Password updated. Check your email, then sign in again on this device.");
    if (status || sessionStatus || resetToken) {
      url.searchParams.delete("verification");
      url.searchParams.delete("session");
      url.searchParams.delete("reset-password");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeNav !== "My teams") return;
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      setTeamRecordsLoading(true);
      try {
        const payload = await fetchJson<{ data: Record<string, string>; meta: { season: number; stale: boolean; unavailable: boolean } }>("/api/teams/records", { cache: "no-store" });
        if (cancelled) return;
        setTeamRecords({ season: payload.meta.season, records: payload.data });
        setTeamRecordsStatus(payload.meta.unavailable ? "Current-season records are temporarily unavailable." : payload.meta.stale ? "Showing saved current-season records; updates are temporarily unavailable." : "");
      } catch {
        if (!cancelled) setTeamRecordsStatus("Could not refresh current-season records. Retrying automatically.");
      } finally {
        pending = false;
        if (!cancelled) setTeamRecordsLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== "Home" && activeNav !== "Live games") return;
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden || Date.now() < gamesRetryAt.current) return;
      pending = true;
      try {
        const payload = await fetchJson<SchedulePayload>("/api/games", { cache: "no-store" });
        if (cancelled) return;
        gamesRetryAt.current = payload.meta?.retryAt ?? 0;
        if (payload.meta?.unavailable) throw new Error(payload.meta.rateLimited ? "The sports provider is rate-limiting requests. Retrying automatically after a cooldown." : "Game data is temporarily unavailable. Retrying automatically.");
        gamesFailures.current = 0;
        setLiveSnapshot(payload.data);
        setLiveError(payload.meta?.stale ? "Showing cached scores. Live updates are temporarily unavailable." : "");
        setSchedule(payload.data.map((game) => mapApiGame(game, account.timezone)));
        setScheduleLoadError(payload.meta?.stale ? "Showing cached games. Retrying updates automatically." : "");
      } catch (cause) {
        if (!cancelled) {
          gamesRetryAt.current = Math.max(gamesRetryAt.current, Date.now() + Math.min(30_000 * 2 ** gamesFailures.current++, 15 * 60_000));
          const message = cause instanceof Error ? cause.message : "Game updates are unavailable. Retrying automatically.";
          setLiveError(message);
          setScheduleLoadError(message);
        }
      } finally {
        pending = false;
        if (!cancelled) { setLiveLoading(false); setUpcomingLoading(false); }
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [activeNav, account.timezone]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson<{ data: Account; meta: { authenticated: boolean; onboardingCompleted: boolean } }>("/api/account"),
      fetchJson<{ data: Preferences }>("/api/preferences"),
      fetchJson<{ data: FeedItem[] }>("/api/feed"),
      fetchJson<{ data: { teams: Team[]; players: Player[] } }>("/api/catalog"),
      fetchJson<{ data: DiscoveryRecommendations }>("/api/recommendations/discovery"),
      fetchJson<{ data: DeliveredAlert[] }>("/api/alerts"),
      fetchJson<{ data: SavedArticleData[] }>("/api/saved/articles").catch(() => ({ data: [] })),
    ]).then(([accountPayload, preferencesPayload, feedPayload, catalogPayload, discoveryPayload, alertsPayload, savedPayload]) => {
      if (!mounted) return;
      const loadedAccount = accountPayload.meta.authenticated ? accountPayload.data : { ...accountPayload.data, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || accountPayload.data.timezone };
      setAccount(loadedAccount);
      setAuthenticated(accountPayload.meta.authenticated);
      setOnboardingOpen(accountPayload.meta.authenticated && !accountPayload.meta.onboardingCompleted);
      setPreferences(preferencesPayload.data);
      setFeedItems(newestFeedFirst(feedPayload.data));
      setTeams(catalogPayload.data.teams);
      setPlayers(catalogPayload.data.players);
      setDiscovery(discoveryPayload.data);
      setNotifications(alertsPayload.data);
      setSavedArticles(savedPayload.data);
    }).catch(() => {
      if (mounted) {
        setPreferenceStatus("Could not load your saved personalization. Showing local defaults.");
      }
    }).finally(() => {
      if (mounted) setPersonalizationLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    let retryTimer: number | undefined;
    let syncRequested = false;
    let attempts = 0;
    const loadReadyBrief = async () => {
      try {
        const payload = await fetchJson<{ data: CatchUpBrief; meta: { ready?: boolean } }>("/api/catch-up", { cache: "no-store" });
        if (!mounted) return;
        if (payload.meta.ready !== false) {
          setCatchUpBrief(payload.data);
          setCatchUpLoading(false);
          return;
        }
        if (!syncRequested) {
          syncRequested = true;
          await fetchJson("/api/feed", { method: "POST", cache: "no-store" }).catch(() => null);
          if (!mounted) return;
        }
      } catch { /* keep the control unavailable and retry */ }
      attempts += 1;
      if (mounted) retryTimer = window.setTimeout(loadReadyBrief, attempts < 10 ? 1_500 : 10_000);
    };
    void loadReadyBrief();
    return () => {
      mounted = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    let thresholdTimer: number | undefined;
    const updateFreshness = () => {
      if (thresholdTimer !== undefined) window.clearTimeout(thresholdTimer);
      const now = Date.now();
      const elapsed = Math.max(0, now - lastFeedRefreshAt);
      setFeedFreshnessStatus(feedFreshnessLabel(lastFeedRefreshAt, now));
      const nextThreshold = feedFreshnessThresholdsMs.find((threshold) => threshold > elapsed);
      if (nextThreshold !== undefined) thresholdTimer = window.setTimeout(updateFreshness, Math.max(100, nextThreshold - elapsed + 50));
    };
    const updateWhenVisible = () => { if (document.visibilityState === "visible") updateFreshness(); };
    updateFreshness();
    window.addEventListener("focus", updateFreshness);
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      if (thresholdTimer !== undefined) window.clearTimeout(thresholdTimer);
      window.removeEventListener("focus", updateFreshness);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [lastFeedRefreshAt]);

  useEffect(() => {
    if (!selectedGameId || activeNav !== "Game details") return;
    let mounted = true;

    const refreshGameCenter = async (quiet = false) => {
      if (quiet) setGameCenterRefreshing(true);
      else setGameCenterLoading(true);
      try {
        const payload = await fetchJson<{ data: GameCenterData }>(`/api/games/${encodeURIComponent(selectedGameId)}`);
        if (!mounted) return;
        setGameCenter(payload.data);
        setGameCenterError("");
        const updatedGame = mapApiGame(payload.data.game, account.timezone);
        setSchedule((current) => current.map((game) => game.id === updatedGame.id ? updatedGame : game));
      } catch (loadError) {
        if (mounted) setGameCenterError(loadError instanceof Error ? loadError.message : "Could not refresh the game center.");
      } finally {
        if (mounted) {
          setGameCenterLoading(false);
          setGameCenterRefreshing(false);
        }
      }
    };

    void refreshGameCenter();
    const interval = window.setInterval(() => void refreshGameCenter(true), 30_000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [selectedGameId, gameCenterRefreshKey, account.timezone, activeNav]);

  const persistPreferences = async (next: Preferences) => {
    if (!authenticated) {
      setPreferenceStatus("Sign in to save teams, players, and alert preferences.");
      setAuthOpen(true);
      return;
    }
    const previous = preferences;
    setPreferences(next);
    setPreferencesSaving(true);
    setPreferenceStatus("Saving…");
    try {
      const payload = await fetchJson<{ data: Preferences }>("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setPreferences(payload.data);
      const [feedPayload, discoveryPayload, catchUpPayload, alertsPayload] = await Promise.all([
        fetchJson<{ data: FeedItem[] }>("/api/feed"),
        fetchJson<{ data: DiscoveryRecommendations }>("/api/recommendations/discovery"),
        fetchJson<{ data: CatchUpBrief; meta: { ready?: boolean } }>("/api/catch-up"),
        fetchJson<{ data: DeliveredAlert[] }>("/api/alerts"),
      ]);
      setFeedItems(newestFeedFirst(feedPayload.data));
      setLastFeedRefreshAt(Date.now());
      setFeedFreshnessStatus("");
      setDiscovery(discoveryPayload.data);
      if (catchUpPayload.meta.ready !== false) setCatchUpBrief(catchUpPayload.data);
      setNotifications(alertsPayload.data);
      setPreferenceStatus("Saved — your feed has been refreshed.");
    } catch {
      setPreferences(previous);
      setPreferenceStatus("Save failed. Your previous choices were restored.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    const followedTeamIds = preferences.followedTeamIds.includes(teamId) ? preferences.followedTeamIds.filter((id) => id !== teamId) : [...preferences.followedTeamIds, teamId];
    void persistPreferences({ ...preferences, followedTeamIds });
  };
  const togglePlayer = (playerId: string) => {
    const followedPlayerIds = preferences.followedPlayerIds.includes(playerId) ? preferences.followedPlayerIds.filter((id) => id !== playerId) : [...preferences.followedPlayerIds, playerId];
    void persistPreferences({ ...preferences, followedPlayerIds });
  };
  const toggleAlert = (key: keyof AlertPreferences) => void persistPreferences({ ...preferences, alerts: { ...preferences.alerts, [key]: !preferences.alerts[key] } });
  const refreshFeed = async () => {
    if (feedRefreshing) return;
    const previousIds = new Set(feedItems.map((item) => item.id));
    setFeedRefreshing(true);
    setFeedRefreshStatus("Checking for new updates…");
    try {
      const payload = await fetchJson<{ data: FeedItem[]; meta: { refreshStatus: "refreshed" | "cached" } }>("/api/feed", { method: "POST", cache: "no-store" });
      const nextItems = newestFeedFirst(payload.data);
      const newCount = nextItems.filter((item) => !previousIds.has(item.id)).length;
      setFeedItems(nextItems);
      setLastFeedRefreshAt(Date.now());
      setFeedFreshnessStatus("");
      setFeedRefreshStatus(newCount > 0
        ? `${newCount} new update${newCount === 1 ? "" : "s"} added.`
        : payload.meta.refreshStatus === "cached" ? "Checked recently — feed is current." : "No new updates yet.");
    } catch (refreshError) {
      setFeedRefreshStatus(refreshError instanceof Error ? refreshError.message : "Could not refresh the feed. Cached updates are still shown.");
    } finally {
      setFeedRefreshing(false);
    }
  };
  const markAllNotificationsRead = async () => {
    if (!authenticated) {
      setAuthOpen(true);
      return;
    }
    await fetchJson("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true, readAt: notification.readAt ?? new Date().toISOString() })));
  };
  const signOut = async () => {
    await fetchJson("/api/auth/logout", { method: "POST" });
    window.location.reload();
  };

  const calendarMonths = useMemo(() => {
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - 12, 1);
    const endYear = today.getMonth() <= 5 ? today.getFullYear() : today.getFullYear() + 1;
    const endMonth = new Date(endYear, 5, 1);
    const months: Date[] = [];
    const cursor = new Date(firstMonth);
    while (cursor <= endMonth) { months.push(new Date(cursor)); cursor.setMonth(cursor.getMonth() + 1); }
    return months;
  }, [today]);

  const selectedMonth = calendarMonths[selectedMonthIndex] ?? calendarMonths[12];
  const calendarFrom = toDateKey(startOfWeek(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)));
  const calendarTo = toDateKey(addDays(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 7));
  const calendarPending = calendarLoading || calendarSettledRange !== `${calendarFrom}:${calendarTo}`;
  useEffect(() => {
    if (activeNav !== "Schedule") return;
    let cancelled = false;
    const key = `${calendarFrom}:${calendarTo}`;
    const cached = monthCache.peek(key);
    setCalendarGames(cached?.value.data.map((game) => mapApiGame(game, account.timezone)) ?? []);
    let retryAt = 0;
    const refresh = async () => {
      if (document.hidden || Date.now() < retryAt) return;
      setCalendarLoading(!monthCache.peek(key));
      setCalendarError("");
      try {
        const entry = await monthCache.get(key, async () => {
          const payload = await fetchJson<SchedulePayload>(`/api/games?from=${calendarFrom}&to=${calendarTo}`);
          retryAt = payload.meta?.retryAt ?? 0;
          if (payload.meta?.unavailable) throw new Error("Schedule unavailable");
          return payload;
        }, (payload) => payload.meta?.expiresAt !== undefined
          ? Math.max(0, payload.meta.expiresAt - Date.now())
          : scheduleTtlMs({ from: calendarFrom, to: calendarTo }, payload.data));
        if (cancelled) return;
        setCalendarGames(entry.value.data.map((game) => mapApiGame(game, account.timezone)));
        if (entry.value.meta?.stale) setCalendarError("Showing cached games. Scores may be out of date. Try again.");
      } catch {
        if (!cancelled) setCalendarError(monthCache.peek(key) ? "Could not refresh. Showing cached games. Try again." : "Could not load games for this month. Try again.");
      } finally {
        if (!cancelled) {
          setCalendarLoading(false);
          setCalendarSettledRange(key);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [activeNav, calendarFrom, calendarTo, calendarRetry, account.timezone]);
  const followedTeams = teams.filter((team) => preferences.followedTeamIds.includes(team.id));
  const followedPlayers = players.filter((player) => preferences.followedPlayerIds.includes(player.id));
  const teamSearchActive = teamSearch.trim().length > 0;
  const playerSearchActive = playerSearch.trim().length > 0;
  const teamSearchMatches = teamSearchActive ? searchTeams(teams, teamSearch) : [];
  const playerSearchMatches = playerSearchActive ? searchPlayers(players, playerSearch) : [];
  const teamRecommendationsById = new Map(discovery.teams.map((recommendation) => [recommendation.team.id, recommendation]));
  const playerRecommendationsById = new Map(discovery.players.map((recommendation) => [recommendation.player.id, recommendation]));
  const visibleTeamSuggestions = teamSearchActive
    ? teamSearchMatches.slice(0, 30).map((team) => teamRecommendationsById.get(team.id) ?? { team, score: null, reason: `${team.short} · ${team.record === "—" ? "NBA team" : `${team.record} record`}` })
    : discovery.teams.slice(0, 8);
  const visiblePlayerSuggestions = playerSearchActive
    ? playerSearchMatches.slice(0, 30).map((player) => playerRecommendationsById.get(player.id) ?? { player, score: null, reason: `${player.teamName} · ${player.position}` })
    : discovery.players.slice(0, 8);
  const hasPersonalization = preferences.followedTeamIds.length > 0 || preferences.followedPlayerIds.length > 0;
  const teamOptions = ["All teams", ...(scheduleScope === "following" ? followedTeams : teams).map((team) => team.name)];
  const effectiveScheduleTeam = teamOptions.includes(scheduleTeam) ? scheduleTeam : "All teams";
  const selectedDay = new Date(`${selectedDate}T12:00:00`);
  const scheduleByScope = useMemo(() => filterGamesByTeamScope(calendarGames, preferences.followedTeamIds, scheduleScope), [preferences.followedTeamIds, calendarGames, scheduleScope]);
  const filteredSchedule = useMemo(() => scheduleByScope.filter((game) => effectiveScheduleTeam === "All teams" || game.home === effectiveScheduleTeam || game.away === effectiveScheduleTeam), [effectiveScheduleTeam, scheduleByScope]);
  const rangeForView = (view: ScheduleView) => {
    if (view === "day") return { start: selectedDay, end: addDays(selectedDay, 1) };
    if (view === "week") { const start = startOfWeek(selectedDay); return { start, end: addDays(start, 7) }; }
    return { start: selectedMonth, end: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1) };
  };
  const range = rangeForView(scheduleView);
  const soonestGames = filteredSchedule.filter((game) => { const date = new Date(`${game.date}T12:00:00`); return date >= range.start && date < range.end; }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const liveGames = useMemo(() => liveSnapshot.filter((game) => game.status === "live").map((game) => mapApiGame(game, account.timezone)), [liveSnapshot, account.timezone]);
  const visibleLiveGames = useMemo(() => filterGamesByTeamScope(liveGames, preferences.followedTeamIds, liveScope), [liveGames, liveScope, preferences.followedTeamIds]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const homeUpcomingGames = upcomingGamesForDay(schedule, dateKeyInTimeZone(new Date().toISOString(), toDateKey(today), account.timezone));
  const monthDays = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const monthStartDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  const calendarBlanks = (monthStartDay + 6) % 7;
  const calendarCells = Array.from({ length: calendarBlanks + monthDays }, (_, index) => index < calendarBlanks ? null : index - calendarBlanks + 1);
  const gamesForDate = (dateKey: string) => filteredSchedule.filter((game) => game.date === dateKey);

  const moveMonth = (amount: number) => { const nextIndex = selectedMonthIndex + amount; if (nextIndex < 0 || nextIndex >= calendarMonths.length) return; setSelectedMonthIndex(nextIndex); setSelectedDate(toDateKey(calendarMonths[nextIndex])); };
  const openGameCenter = (gameId: string) => { setGameBackNav(activeNav); setSelectedGameId(gameId); setGameCenter(null); setGameCenterError(""); setActiveNav("Game details"); window.scrollTo(0, 0); };
  const closeGameCenter = () => { setActiveNav(gameBackNav); setSelectedGameId(null); setGameCenter(null); setGameCenterError(""); };
  const openTeamProfile = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setTeamProfile(null);
    setTeamProfileError("");
    setTeamProfileLoading(true);
    setActiveNav("Team profile");
    window.scrollTo(0, 0);
    try {
      const payload = await fetchJson<{ data: TeamProfileData }>(`/api/teams/${encodeURIComponent(teamId)}`);
      setTeamProfile(payload.data);
    } catch (profileError) {
      setTeamProfileError(profileError instanceof Error ? profileError.message : "Could not load this team profile.");
    } finally {
      setTeamProfileLoading(false);
    }
  };
  const openArticle = async (articleId: string, backNav = activeNav) => {
    const savedSnapshot = savedArticles.find((article) => article.id === articleId) ?? null;
    setSelectedArticleId(articleId);
    setArticleDetail(savedSnapshot);
    setArticleError("");
    setArticleLoading(!savedSnapshot);
    setArticleBackNav(backNav === "Article" ? "Home" : backNav);
    setActiveNav("Article");
    window.scrollTo(0, 0);
    try {
      const payload = await fetchJson<{ data: NewsArticleData }>(`/api/news/${encodeURIComponent(articleId)}`);
      setArticleDetail(payload.data);
    } catch (loadError) {
      if (!savedSnapshot) setArticleError(loadError instanceof Error ? loadError.message : "Could not load this story.");
    } finally {
      setArticleLoading(false);
    }
  };
  const removeSavedStory = async (articleId: string) => {
    if (!authenticated) {
      setSavedArticlesError("Sign in to manage saved stories.");
      setAuthOpen(true);
      return;
    }
    setSavingArticleId(articleId);
    setSavedArticlesError("");
    try {
      await fetchJson(`/api/saved/articles?articleId=${encodeURIComponent(articleId)}`, { method: "DELETE" });
      setSavedArticles((current) => current.filter((article) => article.id !== articleId));
    } catch (saveError) {
      setSavedArticlesError(saveError instanceof Error ? saveError.message : "Could not remove this saved story.");
    } finally {
      setSavingArticleId(null);
    }
  };
  const toggleArticleSave = async () => {
    if (!articleDetail) return;
    if (!authenticated) {
      setArticleError("Sign in to save stories.");
      setAuthOpen(true);
      return;
    }
    const articleId = articleDetail.id;
    if (savedArticles.some((article) => article.id === articleId)) {
      await removeSavedStory(articleId);
      return;
    }
    setSavingArticleId(articleId);
    setSavedArticlesError("");
    try {
      const payload = await fetchJson<{ data: SavedArticleData }>("/api/saved/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId }) });
      setSavedArticles((current) => [payload.data, ...current.filter((article) => article.id !== articleId)]);
    } catch (saveError) {
      setArticleError(saveError instanceof Error ? saveError.message : "Could not save this story.");
    } finally {
      setSavingArticleId(null);
    }
  };
  const openPlayerProfile = async (playerId: string) => {
    if (activeNav !== "Player profile") setPlayerBackNav(activeNav);
    setSelectedPlayerId(playerId);
    setPlayerProfile(null);
    setPlayerProfileError("");
    setPlayerProfileLoading(true);
    setActiveNav("Player profile");
    window.scrollTo(0, 0);
    try {
      const payload = await fetchJson<{ data: PlayerProfileData }>(`/api/players/${encodeURIComponent(playerId)}`);
      setPlayerProfile(payload.data);
    } catch (profileError) {
      setPlayerProfileError(profileError instanceof Error ? profileError.message : "Could not load this player profile.");
    } finally {
      setPlayerProfileLoading(false);
    }
  };
  const openCatchUp = async (gameId?: string) => {
    setCatchUpLoading(true);
    try {
      const payload = await fetchJson<{ data: CatchUpBrief; meta: { ready?: boolean } }>(gameId ? `/api/catch-up?gameId=${encodeURIComponent(gameId)}` : "/api/catch-up");
      if (payload.meta.ready === false) return;
      setCatchUpBrief(payload.data);
      setCatchUpOpen(true);
    } catch (catchUpError) {
      if (!gameId && catchUpBrief) setCatchUpOpen(true);
      else setGameCenterError(catchUpError instanceof Error ? catchUpError.message : "Could not build this catch-up.");
    } finally {
      setCatchUpLoading(false);
    }
  };

  return <TimeZoneContext.Provider value={account.timezone}><main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-dot" />Sports Watch</div>
      <nav className="main-nav" aria-label="Main navigation">{["Home", "Schedule", "Live games", "Leaderboard", "My teams", "My players", "Saved"].map((item) => <button className={activeNav === item || (item === "My teams" && activeNav === "Team profile") || (item === "My players" && activeNav === "Player profile") || (item === "Saved" && activeNav === "Article" && articleBackNav === "Saved") ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)} key={item}><span className="nav-icon">{item === "Home" ? "⌂" : item === "Schedule" ? "▦" : item === "Live games" ? "◉" : item === "Leaderboard" ? "▤" : item === "My teams" ? "◈" : item === "My players" ? "♙" : "◇"}</span>{item}{item === "Live games" && liveGames.length > 0 && <span className="live-pill">{liveGames.length}</span>}{item === "Saved" && savedArticles.length > 0 && <span className="saved-pill">{savedArticles.length}</span>}</button>)}</nav>
      <div className="sidebar-section-label following-label">Following</div>
      <div className="following-list">{followedTeams.slice(0, 2).map((team) => <button className="following-row following-team" key={team.id} onClick={() => void openTeamProfile(team.id)}><TeamMark short={team.short} color={team.color} imageUrl={team.imageUrl} /><span>{team.name.replace(/^(Golden State|New York|Oklahoma City) /, "")}</span></button>)}{followedPlayers.slice(0, 2).map((player) => <button className="following-row following-player" key={player.id} onClick={() => void openPlayerProfile(player.id)}><PlayerAvatar player={player} className="small-avatar" /><span>{player.name}</span></button>)}{followedTeams.length === 0 && followedPlayers.length === 0 && <div className="following-empty">Nothing followed yet</div>}<button className="add-following" onClick={() => { setSettingsSection("preferences"); setActiveNav("Settings"); }}>＋ Manage following</button></div>
      <div className="sidebar-bottom"><button className={activeNav === "Settings" ? "nav-item active" : "nav-item"} onClick={() => { setSettingsSection("account"); setActiveNav("Settings"); }}><span className="nav-icon">⚙</span>Settings</button><div className="profile"><span className="avatar profile-avatar">{initialsFor(account.displayName)}</span><span><strong>{account.displayName}</strong><small>{authenticated ? account.email : "Shared demo mode"}</small></span>{authenticated ? <button className="profile-action" onClick={() => void signOut()}>Sign out</button> : <button className="profile-action" onClick={() => setAuthOpen(true)}>Sign in</button>}</div></div>
    </aside>

    <section className="content-area">
      <header className="topbar"><div className="mobile-brand"><span className="brand-dot" />Sports Watch</div><div className="date-label">{formatLongDateInTimeZone(account.timezone, currentTime)}</div><div className="top-actions">{!authenticated && <button className="top-auth-button" onClick={() => setAuthOpen(true)}>Sign in</button>}<button className="icon-button" aria-label="Search">⌕</button><div className="notification-menu"><button className="notification-button" aria-label={`${unreadCount} unread notifications`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧{unreadCount > 0 && <span />}</button>{notificationsOpen && <section className="notification-panel" aria-label="Notifications"><div className="notification-header"><div><p className="overline">ALERT INBOX</p><h2>Notifications</h2></div>{unreadCount > 0 && <button onClick={() => void markAllNotificationsRead()}>Mark all read</button>}</div>{notifications.length > 0 ? <div className="notification-list">{notifications.map((notification) => <article className={notification.read ? "notification-row read" : "notification-row"} key={notification.id}><span className="notification-kind">{alertIcons[notification.type]}</span><div><p>{alertLabels[notification.type]} · {formatRelativeTime(notification.deliveredAt)}</p><strong>{notification.title}</strong><span>{notification.body}</span></div></article>)}</div> : <div className="notification-empty">No alerts yet. The worker will add important updates here.</div>}</section>}</div></div></header>{verificationNotice && <div className={verificationNotice.startsWith("That") ? "verification-banner error" : "verification-banner"} role="status"><span>{verificationNotice}</span><button onClick={() => setVerificationNotice("")} aria-label="Dismiss verification message">×</button></div>}
      <nav className="mobile-nav" aria-label="Mobile navigation">{[["Home", "⌂"], ["Schedule", "▦"], ["Live games", "◉"], ["Leaderboard", "▤"], ["My teams", "◈"], ["My players", "♙"], ["Saved", "◇"], ["Settings", "⚙"]].map(([item, icon]) => <button className={activeNav === item || (item === "My teams" && activeNav === "Team profile") || (item === "My players" && activeNav === "Player profile") || (item === "Saved" && activeNav === "Article" && articleBackNav === "Saved") ? "active" : ""} onClick={() => { if (item === "Settings") setSettingsSection("account"); setActiveNav(item); }} key={item}><span>{icon}</span>{item === "Live games" ? "Live" : item === "My teams" ? "Teams" : item === "My players" ? "Players" : item}</button>)}</nav>

      {activeNav === "Home" ? <>
        <div className="welcome-row"><div><p className="overline">YOUR NBA, IN FOCUS</p><h1>{greetingForTimeZone(account.timezone, currentTime)}, {account.displayName.split(" ")[0]} <span>✦</span></h1><p className="subhead">Here&apos;s what matters across the teams and players you follow.</p></div><button className="catch-up-button" onClick={() => void openCatchUp()} disabled={!catchUpBrief || catchUpLoading}><span className={catchUpLoading ? "catch-up-loading-icon" : ""}>✦</span><span><strong>{catchUpLoading || !catchUpBrief ? "Loading catch-up…" : "Catch me up"}</strong><small>{catchUpLoading || !catchUpBrief ? "Syncing latest NBA updates" : `${catchUpBrief.readTimeMinutes} min read`}</small></span><b>→</b></button></div>
        <div className="dashboard-grid"><div className="feed-column"><div className="section-heading feed-heading"><div><h2>{hasPersonalization ? "Your feed" : "Popular right now"}</h2><p className="feed-subtitle">{hasPersonalization ? "Ranked for your current favorites" : "League-wide stories to get you started"}</p>{feedRefreshStatus && <p className="feed-refresh-status" aria-live="polite">{feedRefreshStatus}</p>}{feedFreshnessStatus && <p className="feed-freshness-status" aria-live="polite">{feedFreshnessStatus}</p>}</div><div className="feed-heading-actions"><span className="feed-count">{feedItems.length} updates</span><button className="feed-refresh-button" disabled={feedRefreshing || personalizationLoading} onClick={() => void refreshFeed()}><span className={feedRefreshing ? "refresh-icon spinning" : "refresh-icon"}>↻</span>{feedRefreshing ? "Checking…" : "Refresh"}</button></div></div><div className="feed-list" tabIndex={0} aria-label={hasPersonalization ? "Your personalized news feed" : "Popular NBA news feed"}>{personalizationLoading ? <div className="feed-state">Building your personalized feed…</div> : feedItems.length === 0 ? <div className="feed-state"><strong>No current NBA stories are available.</strong><span>Fresh updates will appear here after the next data sync.</span><button onClick={() => setActiveNav("My teams")}>Choose favorites</button></div> : feedItems.map((item) => <article className={`feed-card ${item.accent}`} key={item.id}><div className="feed-icon">{item.kind === "performance" ? "◉" : item.kind === "injury" ? "!" : "✦"}</div><div className="feed-content"><div className="feed-card-top"><p className="card-eyebrow">{item.eyebrow} · {formatRelativeTime(item.publishedAt)}</p><span className="relevance-score">{item.relevanceScore}% {hasPersonalization ? "match" : "popular"}</span><NewsInterestMenu articleId={item.id} onSaved={reloadNewsPreferences} /></div><h3>{item.title}</h3><p className="card-body">{item.body}</p><div className="feed-meta"><span>{item.reason}</span><button onClick={() => void openArticle(item.id, "Home")}>Read story <span>→</span></button></div></div></article>)}</div></div>
          <div className="right-column">
            <section className="section-card" aria-label="Live games on Home"><div className="section-heading compact"><h2>Live games {liveGames.length > 0 && `(${liveGames.length})`}</h2><button className="text-button" onClick={() => setActiveNav("Live games")}>View all →</button></div>{liveError && <p className="preference-status error" role="status">{liveError}</p>}{liveGames.length > 0 ? <div className="home-live-games" tabIndex={0} aria-label="Live matchups">{liveGames.map((game) => <LiveGameCard key={game.id} game={game} onOpen={() => openGameCenter(game.id)} />)}</div> : <div className="mini-empty">{liveLoading ? "Loading live games…" : liveError ? "Unable to confirm live games right now." : "There are no live games right now."}</div>}</section>
            <section className="section-card"><div className="section-heading compact"><h2>Upcoming games</h2><button className="text-button" onClick={() => setActiveNav("Schedule")}>View schedule <span>→</span></button></div>{scheduleLoadError && homeUpcomingGames.length > 0 && <p role="status">{scheduleLoadError}</p>}{upcomingLoading ? <div className="mini-empty" role="status">Loading upcoming games…</div> : scheduleLoadError && homeUpcomingGames.length === 0 ? <div className="mini-empty" role="alert">{scheduleLoadError}</div> : homeUpcomingGames.length > 0 ? homeUpcomingGames.map((game) => { const gameDate = new Date(`${game.date}T12:00:00`); return <button type="button" className="upcoming-game game-link" key={game.id} onClick={() => openGameCenter(game.id)} aria-label={`Open ${game.away} at ${game.home} game`}><div className="upcoming-date"><strong>{gameDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong><span>{gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</span></div><div className="upcoming-teams"><div><TeamMark short={game.awayShort} color={game.awayColor} imageUrl={game.awayImageUrl} /><span>{game.awayShort}</span></div><b>{formatTipTime(game.startsAt, game.time, account.timezone, game.date)}</b><div><TeamMark short={game.homeShort} color={game.homeColor} imageUrl={game.homeImageUrl} /><span>{game.homeShort}</span></div></div><span className="tv-badge">{game.network} →</span></button>; }) : <div className="mini-empty">There are no upcoming games available.</div>}</section>
            <section className="section-card alerts-card"><div className="section-heading compact"><div><h2>Your alerts</h2><p>Stay close to what matters.</p></div><span className={preferencesSaving ? "save-state saving" : "save-state"}>{preferencesSaving ? "Saving…" : "Synced"}</span></div>{([['gameStarting', 'Game starting', '30 minutes before tip-off'], ['closeGame', 'Close game', 'Within 5 points in the 4th or a decisive late play'], ['finalScore', 'Final score', 'As soon as the game ends'], ['injuryUpdate', 'Injury updates', 'When availability changes during a game'], ['leadChange', 'Late lead changes', 'When the lead flips in the 4th quarter'], ['milestone', 'Player milestones', 'Notable achievements during live games'], ['standoutPerformance', 'Standout performances', 'For your favorite players']] as Array<[keyof AlertPreferences, string, string]>).map(([key, title, detail]) => <div className="alert-row" key={key}><span className="alert-icon">{alertIcons[key]}</span><span><strong>{title}</strong><small>{detail}</small></span><button aria-label={`Toggle ${title}`} aria-pressed={preferences.alerts[key]} className={preferences.alerts[key] ? "toggle on" : "toggle"} disabled={preferencesSaving} onClick={() => toggleAlert(key)}><i /></button></div>)}</section>
          </div>
        </div>
      </> : activeNav === "Game details" && selectedGameId ? <>
        <div className="page-heading"><button className="profile-back" onClick={closeGameCenter}>← {gameBackNav}</button><p className="overline">GAME DETAILS</p><h1>{gameCenter ? `${gameCenter.game.away.short} at ${gameCenter.game.home.short}` : "Game details"}</h1>{gameCenter && <p className="subhead">{gameCenter.game.date} · {gameCenter.game.status === "scheduled" ? formatTipTime(gameCenter.game.startsAt, gameCenter.game.time, account.timezone, gameCenter.game.date) : `${gameCenter.game.awayScore ?? "—"} – ${gameCenter.game.homeScore ?? "—"} · ${gameCenter.game.status === "final" ? "Final" : "Live"}`}</p>}</div>
        <BoxScoreView key={selectedGameId} gameId={selectedGameId} onOpenPlayer={(id) => void openPlayerProfile(id)} />
        <GameCenterPanel center={gameCenter} loading={gameCenterLoading} refreshing={gameCenterRefreshing} catchUpLoading={catchUpLoading} error={gameCenterError} onClose={closeGameCenter} onRetry={() => setGameCenterRefreshKey((key) => key + 1)} onCatchUp={() => void openCatchUp(selectedGameId)} />
      </> : activeNav === "Schedule" ? <>
        <div className="page-heading schedule-heading filtered-page-heading">
          <div><p className="overline">{scheduleScope === "following" ? "YOUR FOLLOWED TEAMS" : "FULL NBA CALENDAR"}</p><h1>Schedule</h1><p className="subhead">Browse every game or narrow the calendar to teams you follow. Tip times are shown in {timeZoneDisplayName(account.timezone, currentTime)}.</p></div>
          <GameScopeFilter value={scheduleScope} followedCount={followedTeams.length} label="Filter scheduled games" onChange={(scope) => { setScheduleScope(scope); setScheduleTeam("All teams"); }} />
        </div>
        {calendarPending && <p role="status">Loading games for {formatMonth(selectedMonth)}…</p>}
        {calendarError && <p role="alert">{calendarError} <button className="text-button" onClick={() => setCalendarRetry((value) => value + 1)}>Retry</button></p>}
        <div className="schedule-layout" aria-busy={calendarPending}>
          <section className="calendar-panel">
            <div className="schedule-panel-header"><div><p className="overline">CALENDAR</p><h2>{formatMonth(selectedMonth)}</h2></div><div className="month-controls"><button onClick={() => moveMonth(-1)} disabled={selectedMonthIndex === 0} aria-label="Previous month">←</button><button onClick={() => moveMonth(1)} disabled={selectedMonthIndex === calendarMonths.length - 1} aria-label="Next month">→</button></div></div>
            <div className="calendar-filter-row"><label htmlFor="schedule-team">Show games for</label><select id="schedule-team" value={effectiveScheduleTeam} onChange={(event) => setScheduleTeam(event.target.value)}>{teamOptions.map((team) => <option key={team}>{team}</option>)}</select><span className="calendar-range">{formatMonth(calendarMonths[0])} — {formatMonth(calendarMonths[calendarMonths.length - 1])}</span></div>
            <div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">{calendarCells.map((day, index) => {
              const dateKey = day ? toDateKey(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day)) : `blank-${index}`;
              const dayGames = day ? gamesForDate(dateKey) : [];
              return <div className={day ? `calendar-day ${dateKey === selectedDate ? "selected" : ""} ${dateKey === toDateKey(today) ? "today" : ""}` : "calendar-day blank"} key={dateKey}>
                {day && <><button className="calendar-date-button" aria-label={`Show games on ${dateKey}`} aria-pressed={dateKey === selectedDate} onClick={() => { setSelectedDate(dateKey); setScheduleView("day"); }}><span className="calendar-day-number">{day}</span>{dayGames.length > 0 && <span className="calendar-game-dot"><i />{dayGames.length}</span>}</button>
                {dayGames.slice(0, 2).map((game) => <button className="calendar-game-label" key={game.id} aria-label={`Open ${game.away} at ${game.home} box score`} onClick={() => openGameCenter(game.id)}>{game.awayShort} <b>·</b> {game.homeShort}{game.status === "final" && <span className="calendar-final-score">{game.awayScore ?? "—"}–{game.homeScore ?? "—"} Final</span>}</button>)}
                {dayGames.length > 2 && <button className="calendar-more-games" onClick={() => { setSelectedDate(dateKey); setScheduleView("day"); }}>+{dayGames.length - 2} more</button>}</>}
              </div>;
            })}</div>
            <div className="selected-date-summary"><div><p className="overline">SELECTED DAY</p><h3>{formatShortDate(selectedDay)}</h3></div><span>{gamesForDate(selectedDate).length} game{gamesForDate(selectedDate).length === 1 ? "" : "s"}</span></div>
            {calendarPending ? <div className="empty-schedule" role="status">Loading games…</div> : calendarError && gamesForDate(selectedDate).length === 0 ? <div className="empty-schedule">Games could not be loaded. Use Retry above.</div> : gamesForDate(selectedDate).length > 0 ? <div className="selected-day-games">{gamesForDate(selectedDate).map((game) => <GameRow game={game} key={game.id} onOpen={() => openGameCenter(game.id)} />)}</div> : <div className="empty-schedule compact-empty"><span>◌</span><strong>{scheduleScope === "following" ? "No followed-team games" : "No games available"}</strong><small>{scheduleScope === "following" && followedTeams.length === 0 ? "Follow a team to build your schedule." : "Try another day or team filter."}</small></div>}
          </section>
          <aside className="soonest-panel">
            <div className="section-heading compact"><div><p className="overline">QUICK VIEW</p><h2>Games in range</h2></div><span className="schedule-count">{filteredSchedule.length} total</span></div>
            <div className="schedule-view-tabs" role="tablist" aria-label="Soonest games range">{(["day", "week", "month"] as ScheduleView[]).map((view) => <button className={scheduleView === view ? "active" : ""} key={view} onClick={() => setScheduleView(view)}>{view}</button>)}</div>
            <p className="soonest-description">Showing {scheduleScope === "following" ? "followed-team " : ""}games for {scheduleView === "day" ? formatShortDate(selectedDay) : scheduleView === "week" ? `the week of ${formatShortDate(range.start)}` : formatMonth(selectedMonth)}.</p>
            {calendarPending ? <div className="empty-schedule" role="status">Loading games…</div> : calendarError && soonestGames.length === 0 ? <div className="empty-schedule">Games could not be loaded. Use Retry above.</div> : soonestGames.length > 0 ? <div className="soonest-list" role="region" aria-label="Schedule games" tabIndex={0}>{soonestGames.map((game) => <GameRow game={game} key={game.id} onOpen={() => openGameCenter(game.id)} />)}</div> : <div className="empty-schedule"><span>◌</span><strong>{scheduleScope === "following" ? "No followed-team games" : "No games available"}</strong><small>{scheduleScope === "following" && followedTeams.length === 0 ? "Follow a team to see its games here." : "There are no games in this date range."}</small>{scheduleScope === "following" && followedTeams.length === 0 && <button className="empty-filter-action" onClick={() => setActiveNav("My teams")}>Choose teams</button>}</div>}
            <button className="schedule-reset" onClick={() => { setScheduleScope("all"); setScheduleTeam("All teams"); setScheduleView("day"); setSelectedMonthIndex(12); setSelectedDate(toDateKey(today)); }}>Reset schedule view <span>↺</span></button>
          </aside>
        </div>
      </> : activeNav === "Leaderboard" ? <LeaderboardView metric={leaderboardMetric} selectedPlayerId={leaderboardPlayerId} onMetricChange={setLeaderboardMetric} onOpenPlayer={(id) => void openPlayerProfile(id)} onOpenTeam={(id) => void openTeamProfile(id)} /> : activeNav === "Article" ? <ArticleDetailView article={articleDetail} loading={articleLoading} error={articleError} saved={Boolean(selectedArticleId && savedArticles.some((article) => article.id === selectedArticleId))} saving={savingArticleId === selectedArticleId} backLabel={articleBackNav === "Saved" ? "Saved stories" : articleBackNav === "Team profile" ? "Team profile" : "Home"} teams={teams} players={players} onBack={() => setActiveNav(articleBackNav)} onRetry={() => { if (selectedArticleId) void openArticle(selectedArticleId, articleBackNav); }} onToggleSave={() => void toggleArticleSave()} onOpenTeam={(teamId) => void openTeamProfile(teamId)} onOpenPlayer={(playerId) => void openPlayerProfile(playerId)} /> : activeNav === "Saved" ? <SavedStoriesView articles={savedArticles} savingArticleId={savingArticleId} error={savedArticlesError} onOpen={(articleId) => void openArticle(articleId, "Saved")} onRemove={(articleId) => void removeSavedStory(articleId)} /> : activeNav === "Team profile" ? <TeamProfileView profile={teamProfile} loading={teamProfileLoading} error={teamProfileError} isFollowed={Boolean(selectedTeamId && preferences.followedTeamIds.includes(selectedTeamId))} onBack={() => setActiveNav("My teams")} onRetry={() => { if (selectedTeamId) void openTeamProfile(selectedTeamId); }} onToggleFollow={() => { if (selectedTeamId) toggleTeam(selectedTeamId); }} onOpenPlayer={(playerId) => void openPlayerProfile(playerId)} onOpenGame={openGameCenter} onOpenArticle={(articleId) => void openArticle(articleId, "Team profile")} /> : activeNav === "My teams" ? <>
        <div className="page-heading"><p className="overline">PERSONALIZE YOUR EXPERIENCE</p><h1>My teams</h1><p className="subhead">Choose the teams that should shape your feed, schedule, and alerts.</p>{preferenceStatus && <p className={preferenceStatus.startsWith("Save failed") || preferenceStatus.startsWith("Could not") ? "preference-status error" : "preference-status"}>{preferenceStatus}</p>}</div>
        <section className="preferences-panel">
          <div className="preference-block"><div className="section-heading"><div><h2>Your teams</h2><p className="panel-copy">{nbaSeasonLabel(currentNbaSeasonStart())} regular-season records.</p></div><span className="count-badge">{followedTeams.length} followed</span></div><div className="preference-list">{followedTeams.length > 0 ? followedTeams.map((team) => <div className="preference-row selected team-preference-row" key={team.id}><button className="team-row-profile" onClick={() => void openTeamProfile(team.id)}><TeamMark short={team.short} color={team.color} imageUrl={team.imageUrl} /><span><strong>{team.name}</strong><small>{teamRecords?.season === currentNbaSeasonStart() && teamRecords.records[team.id] ? `${teamRecords.records[team.id]} record` : teamRecordsLoading ? "Loading record…" : "Record unavailable"}</small></span></button><button className="row-follow-action" disabled={preferencesSaving} onClick={() => toggleTeam(team.id)}>Unfollow</button></div>) : <div className="discovery-empty">You are not following any teams yet. Add one from the recommendations.</div>}</div></div>
          {teamRecordsStatus && <p className="preference-status" role="status">{teamRecordsStatus}</p>}
          <div className="preference-block recommendation-block"><div className="section-heading"><div><h2>{hasPersonalization ? "Teams you may like" : "Popular teams"}</h2><p className="panel-copy">{hasPersonalization ? "Personalized candidates first, then popular teams to fill up to eight spots." : "Trending across current coverage and nationally visible games."}</p></div><span className="count-badge">{teamSearchActive ? `${teamSearchMatches.length} result${teamSearchMatches.length === 1 ? "" : "s"}` : `${discovery.teams.length}/8`}</span></div><EntitySearch value={teamSearch} onChange={setTeamSearch} label="Search NBA teams" placeholder="Search all teams by name or abbreviation" /><div className="preference-list">{visibleTeamSuggestions.length > 0 ? visibleTeamSuggestions.map(({ team, score, reason }) => { const followed = preferences.followedTeamIds.includes(team.id); return <div className="recommendation-row team-recommendation-row" key={team.id}><button className="recommendation-profile team-recommendation-profile" onClick={() => void openTeamProfile(team.id)}><TeamMark short={team.short} color={team.color} imageUrl={team.imageUrl} /><span><strong>{team.name}</strong><small>{reason}</small></span></button>{score !== null && <span className="recommendation-score">{score}%</span>}<button className={followed ? "following-result" : ""} disabled={preferencesSaving || followed} onClick={() => toggleTeam(team.id)}>{followed ? "Following" : "Follow"}</button></div>; }) : <div className="discovery-empty">{teamSearchActive ? `No teams match “${teamSearch}”.` : "You already follow every available team recommendation."}</div>}</div></div>
        </section>
      </> : activeNav === "Player profile" ? <PlayerProfileView onOpenLeaderboard={(metric) => { setLeaderboardMetric(metric); setLeaderboardPlayerId(selectedPlayerId); setActiveNav("Leaderboard"); }} profile={playerProfile} loading={playerProfileLoading} error={playerProfileError} isFollowed={Boolean(selectedPlayerId && preferences.followedPlayerIds.includes(selectedPlayerId))} backLabel={playerBackNav} onBack={() => setActiveNav(playerBackNav)} onRetry={() => { if (selectedPlayerId) void openPlayerProfile(selectedPlayerId); }} onToggleFollow={() => { if (selectedPlayerId) togglePlayer(selectedPlayerId); }} /> : activeNav === "My players" ? <>
        <div className="page-heading"><p className="overline">PERSONALIZE YOUR EXPERIENCE</p><h1>My players</h1><p className="subhead">Follow players to prioritize their performances, injuries, and storylines.</p>{preferenceStatus && <p className={preferenceStatus.startsWith("Save failed") || preferenceStatus.startsWith("Could not") ? "preference-status error" : "preference-status"}>{preferenceStatus}</p>}</div>
        <section className="preferences-panel">
          <div className="preference-block"><div className="section-heading"><div><h2>Your players</h2><p className="panel-copy">Players you follow and use to personalize your experience.</p></div><span className="count-badge">{followedPlayers.length} followed</span></div><div className="preference-list">{followedPlayers.length > 0 ? followedPlayers.map((player) => <div className="preference-row selected player-preference-row" key={player.id}><button className="player-row-profile" onClick={() => void openPlayerProfile(player.id)}><PlayerAvatar player={player} className="preference-avatar" /><span><strong>{player.name}</strong><small>{player.teamName} · {player.position}</small></span></button><button className="row-follow-action" disabled={preferencesSaving} onClick={() => togglePlayer(player.id)}>Unfollow</button></div>) : <div className="discovery-empty">You are not following any players yet. Add one from the recommendations.</div>}</div></div>
          <div className="preference-block recommendation-block"><div className="section-heading"><div><h2>{hasPersonalization ? "Players you may like" : "Popular players"}</h2><p className="panel-copy">{hasPersonalization ? "Personalized candidates first, then popular players to fill up to eight spots." : "Trending across recent NBA updates and high-visibility matchups."}</p></div><span className="count-badge">{playerSearchActive ? `${playerSearchMatches.length} result${playerSearchMatches.length === 1 ? "" : "s"}` : `${discovery.players.length}/8`}</span></div><EntitySearch value={playerSearch} onChange={setPlayerSearch} label="Search NBA players" placeholder="Search all players by name, team, or position" /><div className="preference-list">{visiblePlayerSuggestions.length > 0 ? visiblePlayerSuggestions.map(({ player, score, reason }) => { const followed = preferences.followedPlayerIds.includes(player.id); return <div className="recommendation-row player-recommendation-row" key={player.id}><button className="recommendation-profile" onClick={() => void openPlayerProfile(player.id)}><PlayerAvatar player={player} className="preference-avatar" /><span><strong>{player.name}</strong><small>{reason}</small></span></button>{score !== null && <span className="recommendation-score">{score}%</span>}<button className={followed ? "following-result" : ""} disabled={preferencesSaving || followed} onClick={() => togglePlayer(player.id)}>{followed ? "Following" : "Follow"}</button></div>; }) : <div className="discovery-empty">{playerSearchActive ? `No players match “${playerSearch}”.` : "You already follow every available player recommendation."}</div>}</div></div>
        </section>
      </> : activeNav === "Settings" ? <SettingsView account={account} authenticated={authenticated} teams={teams} players={players} preferences={preferences} savingPreferences={preferencesSaving} theme={theme} section={settingsSection} onSectionChange={setSettingsSection} onThemeChange={setTheme} onAccountUpdated={setAccount} onSessionEnded={() => window.location.assign("/?session=password-changed")} onToggleTeam={toggleTeam} onTogglePlayer={togglePlayer} onSignIn={() => setAuthOpen(true)} /> : <>
        <div className="page-heading filtered-page-heading"><div><p className="overline">GAME CENTER</p><h1>Live games</h1><p className="subhead">Follow every live score or focus on teams you follow.</p></div><GameScopeFilter value={liveScope} followedCount={followedTeams.length} label="Filter live games" onChange={setLiveScope} /></div>
        {liveError && <p className="preference-status error" role="status">{liveError}</p>}
        {liveLoading ? <section className="feed-state" role="status">Loading live games…</section> : liveError && liveGames.length === 0 ? <section className="feed-state">Unable to confirm live games right now. Retrying automatically.</section> : visibleLiveGames.length > 0 ? <section className="live-games-grid">{visibleLiveGames.map((game) => <LiveGameCard game={game} key={game.id} onOpen={() => openGameCenter(game.id)} />)}</section> : <section className="feed-state"><strong>{liveScope === "following" ? followedTeams.length === 0 ? "Follow a team to personalize live games." : "None of your teams are live right now." : "No games are live right now."}</strong><span>{liveScope === "following" ? followedTeams.length === 0 ? "Your followed teams will appear here whenever they are playing." : "Switch to All games to see the rest of the league." : "Upcoming games are still available in your schedule."}</span><button onClick={() => liveScope === "following" && followedTeams.length === 0 ? setActiveNav("My teams") : liveScope === "following" ? setLiveScope("all") : setActiveNav("Schedule")}>{liveScope === "following" ? followedTeams.length === 0 ? "Choose teams" : "Show all games" : "View schedule"}</button></section>}

      </>}
    </section>

    {catchUpOpen && catchUpBrief && <CatchUpModal key={catchUpBrief.generatedAt} brief={catchUpBrief} onOpenGame={(id) => { setCatchUpOpen(false); if (activeNav !== "Game details") openGameCenter(id); else if (selectedGameId !== id) { setSelectedGameId(id); setGameCenter(null); setGameCenterError(""); } }} onFeedback={reloadNewsPreferences} onClose={() => setCatchUpOpen(false)} />}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    {passwordResetToken && <ResetPasswordModal token={passwordResetToken} onClose={() => setPasswordResetToken("")} onComplete={() => { setPasswordResetToken(""); setAuthOpen(true); }} />}
    {onboardingOpen && <OnboardingModal teams={teams} players={players} recommendedTeamIds={discovery.teams.map(({ team }) => team.id)} recommendedPlayerIds={discovery.players.map(({ player }) => player.id)} initialPreferences={preferences} />}
  </main></TimeZoneContext.Provider>;
}

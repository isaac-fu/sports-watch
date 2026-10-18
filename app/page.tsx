"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

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
};

type Player = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  position: string;
  initials: string;
  color: string;
};

type Account = { id: string; displayName: string; email: string; timezone: string; createdAt: string };
type AlertPreferences = { gameStarting: boolean; closeGame: boolean; finalScore: boolean; standoutPerformance: boolean; injuryUpdate: boolean; leadChange: boolean; milestone: boolean };
type Preferences = { followedTeamIds: string[]; followedPlayerIds: string[]; alerts: AlertPreferences };
type TeamRecommendation = { team: Team; score: number; reason: string };
type PlayerRecommendation = { player: Player; score: number; reason: string };
type GameRecommendation = { game: ApiGame; score: number; reason: string };
type DiscoveryRecommendations = { teams: TeamRecommendation[]; players: PlayerRecommendation[]; games: GameRecommendation[] };
type CatchUpMoment = { id: string; title: string; detail: string; reason: string; importanceScore: number; source: "game-event" | "news"; context?: string };
type CatchUpBrief = { title: string; lede: string; readTimeMinutes: number; generatedAt: string; game: ApiGame | null; moments: CatchUpMoment[]; source: "play-by-play" | "news" };
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
  awayId: string;
  away: string;
  awayShort: string;
  awayColor: string;
  time: string;
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
  network: string;
  venue: string;
  status: "scheduled" | "live" | "final";
  homeScore?: number;
  awayScore?: number;
  period?: number;
  clock?: string;
  updatedAt?: string;
  home: { id: string; name: string; short: string; color: string };
  away: { id: string; name: string; short: string; color: string };
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
};

type PlayerCareerStat = Omit<PlayerSeasonStat, "season" | "seasonLabel" | "teamId" | "teamName"> & { seasonsPlayed: number };
type PlayerGameLog = { id: string; gameId: string; date: string; opponentName: string; opponentShort: string; homeAway: "home" | "away"; result: "W" | "L"; score: string; minutes: string; points: number; rebounds: number; assists: number; steals: number; blocks: number; turnovers: number; fieldGoals: string; threePointers: string; plusMinus: number };
type PlayerProfileData = {
  player: Player;
  bio: { height?: string; weight?: string; jerseyNumber?: string; college?: string; country?: string; draftYear?: number; draftRound?: number; draftNumber?: number };
  currentSeason: PlayerSeasonStat | null;
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
  roster: Player[];
  recentGames: ApiGame[];
  upcomingGames: ApiGame[];
  articles: NewsArticleData[];
  source: string;
  updatedAt: string;
};

type ScheduleView = "day" | "week" | "month";

const defaultTeams: Team[] = [
  { id: "gsw", name: "Golden State Warriors", short: "GSW", color: "#f3b942", record: "31–27" },
  { id: "nyk", name: "New York Knicks", short: "NYK", color: "#3e7bd6", record: "38–21" },
  { id: "okc", name: "Oklahoma City Thunder", short: "OKC", color: "#ee7654", record: "43–16" },
];

const defaultPlayers: Player[] = [
  { id: "stephen-curry", name: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", position: "Guard", initials: "SC", color: "#d99831" },
  { id: "jalen-brunson", name: "Jalen Brunson", teamId: "nyk", teamName: "New York Knicks", position: "Guard", initials: "JB", color: "#4a82d6" },
  { id: "shai-gilgeous-alexander", name: "Shai Gilgeous-Alexander", teamId: "okc", teamName: "Oklahoma City Thunder", position: "Guard", initials: "SG", color: "#e87554" },
];

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
const initialsFor = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const safeExternalUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
};
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const buildSchedule = (): Game[] => {
  const today = startOfDay(new Date());
  const matchups = [
    ["Golden State Warriors", "GSW", "#f3b942", "Los Angeles Lakers", "LAL", "#8f71c4", "7:30 PM", "ESPN", "Chase Center"],
    ["New York Knicks", "NYK", "#3e7bd6", "Boston Celtics", "BOS", "#73b879", "4:00 PM", "ABC", "Madison Square Garden"],
    ["Golden State Warriors", "GSW", "#f3b942", "Phoenix Suns", "PHX", "#e87554", "7:00 PM", "NBA TV", "Chase Center"],
    ["Oklahoma City Thunder", "OKC", "#ee7654", "Golden State Warriors", "GSW", "#f3b942", "5:30 PM", "ESPN", "Paycom Center"],
    ["Los Angeles Lakers", "LAL", "#8f71c4", "Golden State Warriors", "GSW", "#f3b942", "6:30 PM", "TNT", "Crypto.com Arena"],
    ["Golden State Warriors", "GSW", "#f3b942", "New York Knicks", "NYK", "#3e7bd6", "4:30 PM", "ABC", "Chase Center"],
    ["Oklahoma City Thunder", "OKC", "#ee7654", "New York Knicks", "NYK", "#3e7bd6", "6:00 PM", "NBA TV", "Paycom Center"],
    ["Golden State Warriors", "GSW", "#f3b942", "Denver Nuggets", "DEN", "#4c79c7", "7:00 PM", "ESPN", "Chase Center"],
    ["New York Knicks", "NYK", "#3e7bd6", "Miami Heat", "MIA", "#ed8068", "4:00 PM", "TNT", "Madison Square Garden"],
    ["Golden State Warriors", "GSW", "#f3b942", "Dallas Mavericks", "DAL", "#6a9bc8", "6:30 PM", "ESPN", "Chase Center"],
  ];
  const offsets = [1, 3, 5, 9, 16, 23, 31, 38, 45, 53];
  return offsets.map((offset, index) => {
    const matchup = matchups[index];
    const gameDate = addDays(today, offset);
    return { id: `game-${index + 1}`, date: toDateKey(gameDate), homeId: matchup[1].toLowerCase(), home: matchup[0], homeShort: matchup[1], homeColor: matchup[2], awayId: matchup[4].toLowerCase(), away: matchup[3], awayShort: matchup[4], awayColor: matchup[5], time: matchup[6], network: matchup[7], venue: matchup[8], status: "scheduled" };
  });
};

const mapApiGame = (game: ApiGame): Game => ({ id: game.id, date: game.date, time: game.time, network: game.network, venue: game.venue, status: game.status, homeScore: game.homeScore, awayScore: game.awayScore, period: game.period, clock: game.clock, updatedAt: game.updatedAt, homeId: game.home.id, home: game.home.name, homeShort: game.home.short, homeColor: game.home.color, awayId: game.away.id, away: game.away.name, awayShort: game.away.short, awayColor: game.away.color });

function TeamMark({ short, color }: { short: string; color: string }) {
  return <span className="team-mark" style={{ background: color }}>{short}</span>;
}

function GameRow({ game }: { game: Game }) {
  const gameDate = new Date(`${game.date}T12:00:00`);
  return <article className="schedule-game-row"><div className="schedule-game-date"><strong>{gameDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong><span>{gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div><div className="schedule-matchup"><div><TeamMark short={game.awayShort} color={game.awayColor} /><span>{game.away}</span></div><b>at</b><div><TeamMark short={game.homeShort} color={game.homeColor} /><span>{game.home}</span></div></div><div className="schedule-game-time"><strong>{game.time}</strong><span>{game.network}</span></div></article>;
}

function LiveGameCard({ game, onOpen }: { game: Game; onOpen?: () => void }) {
  const status = game.period ? `${game.period === 4 ? "4th quarter" : `Q${game.period}`} · ${game.clock ?? "Live"}` : "Live now";
  return <section className="game-card"><div className="game-card-header"><div><p className="overline light">LIVE NOW</p><span className="game-status"><i /> {status}</span></div></div><div className="matchup"><div className="team-score"><TeamMark short={game.awayShort} color={game.awayColor} /><strong>{game.awayScore ?? "—"}</strong><span>{game.away}</span></div><div className="score-divider">—</div><div className="team-score"><TeamMark short={game.homeShort} color={game.homeColor} /><strong>{game.homeScore ?? "—"}</strong><span>{game.home}</span></div></div><div className="game-card-footer"><span>{game.network} · {game.venue}</span>{onOpen ? <button onClick={onOpen}>Open game center <span>↗</span></button> : <span>Live provider data</span>}</div></section>;
}

function GameCenterPanel({ center, loading, refreshing, catchUpLoading, error, onClose, onRetry, onCatchUp }: { center: GameCenterData | null; loading: boolean; refreshing: boolean; catchUpLoading: boolean; error: string; onClose: () => void; onRetry: () => void; onCatchUp: () => void }) {
  if (loading && !center) return <section className="game-center-panel game-center-loading"><span className="live-loader" /><strong>Opening game center…</strong><small>Loading the latest score and play-by-play.</small></section>;
  if (!center) return <section className="game-center-panel game-center-loading"><strong>Could not open this game.</strong><small>{error || "The game center is temporarily unavailable."}</small><button onClick={onRetry}>Try again</button></section>;

  const { game } = center;
  const statusLabel = game.status === "final" ? "Final" : game.status === "scheduled" ? `${game.date} · ${game.time}` : `${game.period && game.period > 4 ? `OT${game.period - 4}` : `Q${game.period ?? "—"}`} · ${game.clock ?? "Live"}`;
  const latestEvents = [...center.events].sort((a, b) => b.sequence - a.sequence);
  const emptyMessage = center.playByPlayStatus === "pending" ? "Play-by-play will begin at tip-off." : "Play-by-play is not available for this game yet.";
  const sourceLabel = center.source === "mock-repository" ? "Demo game data" : "BALLDONTLIE live data";
  const iconFor = (type: GameEvent["type"]) => type === "score" ? "+" : type === "injury" ? "!" : type === "turnover" ? "↺" : type === "milestone" ? "✦" : type === "period" ? "◷" : "•";

  return <section className="game-center-panel" aria-label={`${game.away.name} at ${game.home.name} game center`}>
    <div className="game-center-top"><div><p className="overline">SELECTED GAME</p><h2>{game.away.short} at {game.home.short}</h2></div><div className="game-center-actions"><span className={refreshing ? "refresh-state active" : "refresh-state"}>{refreshing ? "Updating…" : game.status === "live" ? "Auto-updates every 15 sec" : sourceLabel}</span><button className="game-center-catchup" onClick={onCatchUp} disabled={catchUpLoading || game.status === "scheduled"}>{catchUpLoading ? "Building recap…" : "✦ Catch me up"}</button><button className="game-center-close" onClick={onClose} aria-label="Close game center">×</button></div></div>
    {error && <div className="game-center-warning">{error} Showing the most recent update.</div>}
    <div className="game-center-scoreboard"><div className="game-center-team"><TeamMark short={game.away.short} color={game.away.color} /><span><strong>{game.away.name}</strong><small>Away</small></span><b>{game.awayScore ?? "—"}</b></div><div className={game.status === "live" ? "center-game-status live" : "center-game-status"}><i />{statusLabel}</div><div className="game-center-team home"><b>{game.homeScore ?? "—"}</b><span><strong>{game.home.name}</strong><small>Home</small></span><TeamMark short={game.home.short} color={game.home.color} /></div></div>
    <div className="game-center-meta"><span>{game.network}</span><span>{game.venue}</span><span>Updated {formatRelativeTime(center.updatedAt)}</span></div>
    <div className="game-center-columns"><div className="play-by-play"><div className="game-center-section-heading"><div><p className="overline">LIVE TIMELINE</p><h3>Play-by-play</h3></div><span>{center.events.length} plays</span></div>{latestEvents.length > 0 ? <ol className="event-list">{latestEvents.map((event) => <li key={event.id}><span className={`event-icon ${event.type}`}>{iconFor(event.type)}</span><div><div className="event-heading"><span>{event.periodLabel} · {event.clock || "—"}</span>{event.homeScore !== undefined && event.awayScore !== undefined && <b>{game.away.short} {event.awayScore} · {game.home.short} {event.homeScore}</b>}</div><strong>{event.title}</strong><p>{event.description}</p></div></li>)}</ol> : <div className="game-center-empty">{emptyMessage}</div>}</div><aside className="key-moments-panel"><div className="game-center-section-heading"><div><p className="overline">WHY IT MATTERS</p><h3>Key moments</h3></div><span>Top {center.keyMoments.length}</span></div>{center.keyMoments.length > 0 ? <ol className="key-moment-list">{center.keyMoments.map((event, index) => <li key={event.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{event.periodLabel} · {event.clock || "—"} · {event.importanceScore}% impact</small><strong>{event.title}</strong><p>{event.description}</p></div></li>)}</ol> : <div className="game-center-empty">Important moments will appear as the game develops.</div>}<div className="provider-note"><span className="status-dot" />{sourceLabel}</div></aside></div>
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
    <p className="article-context">Courtside keeps the publisher&apos;s concise summary here so you can understand why the story matters before deciding whether to open the original coverage.</p>
    <div className="article-actions"><button className={saved ? "article-save saved" : "article-save"} disabled={saving} onClick={onToggleSave}>{saving ? "Saving…" : saved ? "✓ Saved" : "＋ Save story"}</button>{externalUrl ? <a href={externalUrl} target="_blank" rel="noreferrer">Read at {article.source} <span>↗</span></a> : <span className="article-demo-note">Full article link unavailable in demo data</span>}</div>{error && <p className="preference-status error">{error}</p>}
  </article>
    {(relatedTeams.length > 0 || relatedPlayers.length > 0) && <section className="article-related"><div className="section-heading"><div><p className="overline">PERSONALIZED CONTEXT</p><h2>People and teams in this story</h2></div></div><div className="article-related-list">{relatedTeams.map((team) => <button key={team.id} onClick={() => onOpenTeam(team.id)}><TeamMark short={team.short} color={team.color} /><span><strong>{team.name}</strong><small>{team.record} record</small></span><b>Team profile →</b></button>)}{relatedPlayers.map((player) => <button key={player.id} onClick={() => onOpenPlayer(player.id)}><span className="avatar preference-avatar" style={{ background: player.color }}>{player.initials}</span><span><strong>{player.name}</strong><small>{player.teamName} · {player.position}</small></span><b>Player profile →</b></button>)}</div></section>}
  </div>;
}

function SavedStoriesView({ articles, savingArticleId, error, onOpen, onRemove }: { articles: SavedArticleData[]; savingArticleId: string | null; error: string; onOpen: (articleId: string) => void; onRemove: (articleId: string) => void }) {
  return <><div className="page-heading"><p className="overline">YOUR LIBRARY</p><h1>Saved stories</h1><p className="subhead">Keep important NBA coverage close, even after the live feed changes.</p>{error && <p className="preference-status error">{error}</p>}</div><section className="saved-stories-panel"><div className="section-heading"><div><h2>Articles</h2><p className="panel-copy">Saved independently for this account.</p></div><span className="count-badge">{articles.length} saved</span></div>{articles.length > 0 ? <div className="saved-story-list">{articles.map((article) => <article key={article.id}><button className="saved-story-main" onClick={() => onOpen(article.id)}><span className="saved-story-source">{article.source} · Saved {formatRelativeTime(article.savedAt)}</span><strong>{article.title}</strong><p>{article.summary}</p><span className="saved-story-tags">{article.tags.slice(0, 3).join(" · ")}</span></button><button className="saved-story-remove" disabled={savingArticleId === article.id} onClick={() => onRemove(article.id)}>{savingArticleId === article.id ? "Removing…" : "Remove"}</button></article>)}</div> : <div className="saved-stories-empty"><span>◇</span><strong>No saved stories yet</strong><p>Open a story from your feed or a team profile, then choose “Save story.”</p></div>}</section></>;
}

function TeamProfileView({ profile, loading, error, isFollowed, onBack, onRetry, onToggleFollow, onOpenPlayer, onOpenGame, onOpenArticle }: { profile: TeamProfileData | null; loading: boolean; error: string; isFollowed: boolean; onBack: () => void; onRetry: () => void; onToggleFollow: () => void; onOpenPlayer: (playerId: string) => void; onOpenGame: (gameId: string) => void; onOpenArticle: (articleId: string) => void }) {
  if (loading && !profile) return <><div className="page-heading team-profile-heading"><button className="profile-back" onClick={onBack}>← My teams</button><p className="overline">TEAM PROFILE</p><h1>Loading team…</h1></div><section className="player-profile-state"><span className="live-loader" /><strong>Loading team overview</strong><small>Collecting season stats, roster, games, and news.</small></section></>;
  if (!profile) return <><div className="page-heading team-profile-heading"><button className="profile-back" onClick={onBack}>← My teams</button><p className="overline">TEAM PROFILE</p><h1>Team unavailable</h1></div><section className="player-profile-state"><strong>Could not load this team.</strong><small>{error || "Team information is temporarily unavailable."}</small><button onClick={onRetry}>Try again</button></section></>;

  const pointDifferential = Number((profile.stats.pointsPerGame - profile.stats.pointsAllowedPerGame).toFixed(1));
  const sourceLabel = profile.source === "mock-repository" ? "Demo team data" : profile.source;
  const resultFor = (game: ApiGame) => {
    const isHome = game.home.id === profile.team.id;
    const teamScore = isHome ? game.homeScore ?? 0 : game.awayScore ?? 0;
    const opponentScore = isHome ? game.awayScore ?? 0 : game.homeScore ?? 0;
    return { isHome, opponent: isHome ? game.away : game.home, teamScore, opponentScore, result: teamScore >= opponentScore ? "W" : "L" };
  };

  return <div className="team-profile-page"><div className="team-profile-heading"><button className="profile-back" onClick={onBack}>← My teams</button></div>
    <section className="team-profile-hero"><TeamMark short={profile.team.short} color={profile.team.color} /><div><p className="overline">{profile.seasonLabel} SEASON</p><h1>{profile.team.name}</h1><p>{profile.stats.wins}–{profile.stats.losses} · #{profile.stats.conferenceRank} in conference</p></div><button className={isFollowed ? "profile-follow following" : "profile-follow"} onClick={onToggleFollow}>{isFollowed ? "✓ Following" : "+ Follow team"}</button></section>
    <section className="team-metric-strip"><div><strong>{profile.stats.wins}–{profile.stats.losses}</strong><span>Record</span></div><div><strong>#{profile.stats.conferenceRank}</strong><span>Conference</span></div><div><strong>{profile.stats.pointsPerGame}</strong><span>Points per game</span></div><div><strong>{profile.stats.pointsAllowedPerGame}</strong><span>Points allowed</span></div><div><strong className={pointDifferential >= 0 ? "positive" : "negative"}>{pointDifferential > 0 ? "+" : ""}{pointDifferential}</strong><span>Point differential</span></div></section>

    <div className="team-profile-grid"><section className="team-profile-panel roster-panel"><div className="section-heading"><div><p className="overline">PLAYERS TO KNOW</p><h2>Roster</h2><p className="panel-copy">Open any player for season, career, and last-10 statistics.</p></div><span className="count-badge">{profile.roster.length} players</span></div>{profile.roster.length > 0 ? <div className="team-roster-list">{profile.roster.map((player) => <button key={player.id} onClick={() => onOpenPlayer(player.id)}><span className="avatar preference-avatar" style={{ background: player.color }}>{player.initials}</span><span><strong>{player.name}</strong><small>{player.position}</small></span><b>→</b></button>)}</div> : <div className="profile-empty">No catalog players are available for this roster yet.</div>}</section>
      <section className="team-profile-panel"><div className="section-heading"><div><p className="overline">LATEST COVERAGE</p><h2>Team news</h2></div><span className="count-badge">{profile.articles.length} stories</span></div>{profile.articles.length > 0 ? <div className="team-news-list">{profile.articles.map((article) => <button key={article.id} onClick={() => onOpenArticle(article.id)}><small>{article.source} · {formatRelativeTime(article.publishedAt)}</small><strong>{article.title}</strong><p>{article.summary}</p><b>Read story →</b></button>)}</div> : <div className="profile-empty">No current stories are available for this team.</div>}</section></div>

    <section className="team-profile-panel team-games-panel"><div className="section-heading"><div><p className="overline">SCHEDULE</p><h2>Upcoming games</h2></div><span className="count-badge">Next {profile.upcomingGames.length}</span></div>{profile.upcomingGames.length > 0 ? <div className="team-game-list">{profile.upcomingGames.map((game) => { const isHome = game.home.id === profile.team.id; const opponent = isHome ? game.away : game.home; return <button key={game.id} onClick={() => onOpenGame(game.id)}><span className="team-game-date">{new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><TeamMark short={opponent.short} color={opponent.color} /><span><strong>{isHome ? "vs" : "@"} {opponent.name}</strong><small>{game.status === "live" ? `${game.period ? `Q${game.period}` : "Live"} · ${game.clock ?? "Live"}` : `${game.time} · ${game.network}`}</small></span><b>{game.status === "live" ? "Open live →" : "Game center →"}</b></button>; })}</div> : <div className="profile-empty">No upcoming games are available.</div>}</section>

    <section className="team-profile-panel team-games-panel"><div className="section-heading"><div><p className="overline">RESULTS</p><h2>Recent games</h2></div><span className="count-badge">Last {profile.recentGames.length}</span></div>{profile.recentGames.length > 0 ? <div className="team-game-list">{profile.recentGames.map((game) => { const result = resultFor(game); return <button key={game.id} onClick={() => onOpenGame(game.id)}><span className="team-game-date">{new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><TeamMark short={result.opponent.short} color={result.opponent.color} /><span><strong>{result.isHome ? "vs" : "@"} {result.opponent.name}</strong><small>{game.network} · Final</small></span><span className={result.result === "W" ? "team-game-result win" : "team-game-result loss"}>{result.result} {result.teamScore}–{result.opponentScore}</span></button>; })}</div> : <div className="profile-empty">No recent final scores are available.</div>}<div className="provider-note"><span className="status-dot" />{sourceLabel} · Updated {formatRelativeTime(profile.updatedAt)}</div></section>
  </div>;
}

function PlayerProfileView({ profile, loading, error, isFollowed, onBack, onRetry, onToggleFollow }: { profile: PlayerProfileData | null; loading: boolean; error: string; isFollowed: boolean; onBack: () => void; onRetry: () => void; onToggleFollow: () => void }) {
  if (loading && !profile) return <><div className="page-heading player-profile-heading"><button className="profile-back" onClick={onBack}>← My players</button><p className="overline">PLAYER PROFILE</p><h1>Loading player…</h1></div><section className="player-profile-state"><span className="live-loader" /><strong>Loading season and career statistics</strong><small>Collecting the latest player data and game logs.</small></section></>;
  if (!profile) return <><div className="page-heading player-profile-heading"><button className="profile-back" onClick={onBack}>← My players</button><p className="overline">PLAYER PROFILE</p><h1>Player unavailable</h1></div><section className="player-profile-state"><strong>Could not load this profile.</strong><small>{error || "Player statistics are temporarily unavailable."}</small><button onClick={onRetry}>Try again</button></section></>;

  const season = profile.currentSeason;
  const career = profile.career;
  const seasonMetrics = season ? [["PPG", season.pointsPerGame], ["RPG", season.reboundsPerGame], ["APG", season.assistsPerGame], ["SPG", season.stealsPerGame], ["FG%", `${season.fieldGoalPercentage}%`], ["3P%", `${season.threePointPercentage}%`]] : [];
  const careerMetrics = career ? [["PPG", career.pointsPerGame], ["RPG", career.reboundsPerGame], ["APG", career.assistsPerGame], ["Games", career.gamesPlayed], ["FG%", `${career.fieldGoalPercentage}%`], ["3P%", `${career.threePointPercentage}%`]] : [];
  const draft = profile.bio.draftYear ? `${profile.bio.draftYear}${profile.bio.draftRound ? ` · Round ${profile.bio.draftRound}` : ""}${profile.bio.draftNumber ? ` · Pick ${profile.bio.draftNumber}` : ""}` : "—";
  const sourceLabel = profile.source === "mock-repository" ? "Demo profile data" : "BALLDONTLIE player data";

  return <div className="player-profile-page">
    <div className="player-profile-heading"><button className="profile-back" onClick={onBack}>← My players</button></div>
    <section className="player-profile-hero"><span className="avatar player-profile-avatar" style={{ background: profile.player.color }}>{profile.player.initials}</span><div className="player-profile-title"><p className="overline">{profile.player.position}{profile.bio.jerseyNumber ? ` · #${profile.bio.jerseyNumber}` : ""}</p><h1>{profile.player.name}</h1><p>{profile.player.teamName}</p></div><button className={isFollowed ? "profile-follow following" : "profile-follow"} onClick={onToggleFollow}>{isFollowed ? "✓ Following" : "+ Follow player"}</button></section>
    <div className="player-bio-strip"><div><span>Height</span><strong>{profile.bio.height ?? "—"}</strong></div><div><span>Weight</span><strong>{profile.bio.weight ? `${profile.bio.weight} lb` : "—"}</strong></div><div><span>Country</span><strong>{profile.bio.country ?? "—"}</strong></div><div><span>College</span><strong>{profile.bio.college ?? "—"}</strong></div><div><span>Draft</span><strong>{draft}</strong></div></div>

    <div className="player-stat-panels"><section className="player-stat-panel"><div className="section-heading"><div><p className="overline">CURRENT FORM</p><h2>{season?.seasonLabel ?? "Current season"}</h2></div><span className="count-badge">{season ? `${season.gamesPlayed} GP` : "No data"}</span></div>{season ? <div className="player-stat-grid">{seasonMetrics.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div> : <div className="profile-empty">Current-season averages are not available yet.</div>}</section>
      <section className="player-stat-panel"><div className="section-heading"><div><p className="overline">REGULAR SEASON</p><h2>Career averages</h2></div><span className="count-badge">{career ? `${career.seasonsPlayed} seasons` : "No data"}</span></div>{career ? <div className="player-stat-grid">{careerMetrics.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div> : <div className="profile-empty">Career averages are not available for this player.</div>}</section></div>

    <section className="player-data-panel"><div className="section-heading"><div><p className="overline">RECENT FORM</p><h2>Last 10 games</h2><p className="panel-copy">Complete box-score lines from the latest regular-season games.</p></div><span className="count-badge">{profile.lastTenGames.length} games</span></div>{profile.lastTenGames.length > 0 ? <div className="player-table-wrap"><table className="player-stats-table"><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>3PT</th><th>+/-</th></tr></thead><tbody>{profile.lastTenGames.map((game) => <tr key={game.id}><td>{new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td><strong>{game.homeAway === "home" ? "vs" : "@"} {game.opponentShort}</strong></td><td><span className={game.result === "W" ? "game-result win" : "game-result loss"}>{game.result}</span> {game.score}</td><td>{game.minutes}</td><td><strong>{game.points}</strong></td><td>{game.rebounds}</td><td>{game.assists}</td><td>{game.steals}</td><td>{game.blocks}</td><td>{game.turnovers}</td><td>{game.fieldGoals}</td><td>{game.threePointers}</td><td className={game.plusMinus >= 0 ? "positive" : "negative"}>{game.plusMinus > 0 ? "+" : ""}{game.plusMinus}</td></tr>)}</tbody></table></div> : <div className="profile-empty table-empty">No completed game logs are available for the current season.</div>}</section>

    <section className="player-data-panel"><div className="section-heading"><div><p className="overline">CAREER</p><h2>Season by season</h2><p className="panel-copy">Regular-season averages, weighted by games played in the career summary above.</p></div><span className="count-badge">{profile.seasons.length} seasons</span></div>{profile.seasons.length > 0 ? <div className="player-table-wrap"><table className="player-stats-table season-history"><thead><tr><th>Season</th><th>Team</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG%</th><th>3P%</th></tr></thead><tbody>{profile.seasons.map((item) => <tr key={item.season}><td><strong>{item.seasonLabel}</strong></td><td>{item.teamName}</td><td>{item.gamesPlayed}</td><td>{item.pointsPerGame}</td><td>{item.reboundsPerGame}</td><td>{item.assistsPerGame}</td><td>{item.stealsPerGame}</td><td>{item.blocksPerGame}</td><td>{item.turnoversPerGame}</td><td>{item.fieldGoalPercentage}</td><td>{item.threePointPercentage}</td></tr>)}</tbody></table></div> : <div className="profile-empty table-empty">Season history is unavailable.</div>}<div className="provider-note"><span className="status-dot" />{sourceLabel} · Updated {formatRelativeTime(profile.updatedAt)}</div></section>
  </div>;
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = mode === "register"
      ? { displayName: form.get("displayName"), email: form.get("email"), password: form.get("password"), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { email: form.get("email"), password: form.get("password") };
    try {
      await fetchJson(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
      setSubmitting(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><div className="auth-brand"><span className="brand-dot" />courtside</div><p className="overline">YOUR NBA, SAVED</p><h2 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="auth-copy">{mode === "login" ? "Sign in to load your teams, players, alerts, and personal feed." : "Save your favorites and get a personal NBA feed on every visit."}</p><form className="auth-form" onSubmit={submit}>{mode === "register" && <label>Display name<input name="displayName" autoComplete="name" minLength={2} maxLength={50} required placeholder="Isaac" /></label>}<label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} required placeholder="At least 8 characters" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<span>→</span></button></form><button className="auth-switch" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "New to Courtside? Create an account" : "Already have an account? Sign in"}</button><p className="auth-demo">You can close this window to keep exploring in shared demo mode.</p></section></div>;
}

function OnboardingModal({ teams, players, recommendedTeamIds, recommendedPlayerIds, initialPreferences }: { teams: Team[]; players: Player[]; recommendedTeamIds: string[]; recommendedPlayerIds: string[]; initialPreferences: Preferences }) {
  const [step, setStep] = useState(0);
  const [teamIds, setTeamIds] = useState<string[]>(initialPreferences.followedTeamIds);
  const [playerIds, setPlayerIds] = useState<string[]>(initialPreferences.followedPlayerIds);
  const [alerts, setAlerts] = useState(initialPreferences.alerts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const recommendedTeams = new Set(recommendedTeamIds);
  const recommendedPlayers = new Set(recommendedPlayerIds);

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

  return <div className="modal-backdrop"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div className="onboarding-top"><div className="auth-brand"><span className="brand-dot" />courtside</div><button className="onboarding-skip" disabled={saving} onClick={() => void complete(true)}>Skip setup</button></div><div className="onboarding-progress">{stepNames.map((name, index) => <div className={index === step ? "active" : index < step ? "complete" : ""} key={name}><span>{index < step ? "✓" : index + 1}</span><small>{name}</small></div>)}</div>{step === 0 ? <><p className="overline">STEP 1 OF 3</p><h2 id="onboarding-title">Choose your teams</h2><p className="auth-copy">Your choices shape game schedules, news, catch-ups, and alerts. You can change them anytime.</p><div className="onboarding-grid">{teams.map((team) => { const selected = teamIds.includes(team.id); return <button className={selected ? "onboarding-choice selected" : "onboarding-choice"} key={team.id} onClick={() => toggleId(team.id, teamIds, setTeamIds)}><TeamMark short={team.short} color={team.color} /><span><strong>{team.name}</strong><small>{recommendedTeams.has(team.id) ? "Popular pick" : team.record === "—" ? "NBA team" : `${team.record} record`}</small></span><b>{selected ? "✓" : "+"}</b></button>; })}</div></> : step === 1 ? <><p className="overline">STEP 2 OF 3</p><h2 id="onboarding-title">Choose your players</h2><p className="auth-copy">Follow players to prioritize performances, injuries, and important storylines.</p><div className="onboarding-grid">{players.map((player) => { const selected = playerIds.includes(player.id); return <button className={selected ? "onboarding-choice selected" : "onboarding-choice"} key={player.id} onClick={() => toggleId(player.id, playerIds, setPlayerIds)}><span className="avatar preference-avatar" style={{ background: player.color }}>{player.initials}</span><span><strong>{player.name}</strong><small>{recommendedPlayers.has(player.id) ? "Popular pick" : player.teamName}</small></span><b>{selected ? "✓" : "+"}</b></button>; })}</div></> : <><p className="overline">STEP 3 OF 3</p><h2 id="onboarding-title">Choose your alerts</h2><p className="auth-copy">Start with the moments worth interrupting your day for.</p><div className="onboarding-alerts">{(Object.keys(alertLabels) as Array<keyof AlertPreferences>).map((key) => <button className={alerts[key] ? "onboarding-alert selected" : "onboarding-alert"} key={key} onClick={() => setAlerts((current) => ({ ...current, [key]: !current[key] }))}><span>{alertIcons[key]}</span><strong>{alertLabels[key]}</strong><b>{alerts[key] ? "On" : "Off"}</b></button>)}</div></>}{error && <p className="auth-error" role="alert">{error}</p>}<div className="onboarding-actions">{step > 0 ? <button className="onboarding-back" disabled={saving} onClick={() => setStep((current) => current - 1)}>← Back</button> : <span />}<div><small>{teamIds.length} teams · {playerIds.length} players</small><button className="auth-submit" disabled={saving} onClick={() => step < 2 ? setStep((current) => current + 1) : void complete()}>{saving ? "Saving…" : step < 2 ? "Continue" : "Finish setup"}<span>→</span></button></div></div></section></div>;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <main className="app-boot"><div className="brand"><span className="brand-dot" />courtside</div><span className="live-loader" /><small>Loading your NBA…</small></main>;
  return <CourtsideApp />;
}

function CourtsideApp() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const fallbackSchedule = useMemo(() => buildSchedule(), []);
  const [schedule, setSchedule] = useState<Game[]>(fallbackSchedule);
  const [teams, setTeams] = useState<Team[]>(defaultTeams);
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [account, setAccount] = useState<Account>({ id: "account-demo", displayName: "Alex Morgan", email: "", timezone: "America/Los_Angeles", createdAt: "" });
  const [authenticated, setAuthenticated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({ followedTeamIds: ["gsw"], followedPlayerIds: ["stephen-curry"], alerts: { gameStarting: true, closeGame: true, finalScore: true, standoutPerformance: false, injuryUpdate: true, leadChange: true, milestone: false } });
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryRecommendations>({ teams: [], players: [], games: [] });
  const [catchUpBrief, setCatchUpBrief] = useState<CatchUpBrief | null>(null);
  const [notifications, setNotifications] = useState<DeliveredAlert[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [personalizationLoading, setPersonalizationLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const [activeNav, setActiveNav] = useState("Home");
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [catchUpLoading, setCatchUpLoading] = useState(false);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("month");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [scheduleTeam, setScheduleTeam] = useState("All teams");
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

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson<{ data: ApiGame[] }>("/api/games"),
      fetchJson<{ data: Account; meta: { authenticated: boolean; onboardingCompleted: boolean } }>("/api/account"),
      fetchJson<{ data: Preferences }>("/api/preferences"),
      fetchJson<{ data: FeedItem[] }>("/api/feed"),
      fetchJson<{ data: { teams: Team[]; players: Player[] } }>("/api/catalog"),
      fetchJson<{ data: DiscoveryRecommendations }>("/api/recommendations/discovery"),
      fetchJson<{ data: CatchUpBrief }>("/api/catch-up"),
      fetchJson<{ data: DeliveredAlert[] }>("/api/alerts", { method: "POST" }).then(() => fetchJson<{ data: DeliveredAlert[] }>("/api/alerts")),
      fetchJson<{ data: SavedArticleData[] }>("/api/saved/articles").catch(() => ({ data: [] })),
    ]).then(([gamesPayload, accountPayload, preferencesPayload, feedPayload, catalogPayload, discoveryPayload, catchUpPayload, alertsPayload, savedPayload]) => {
      if (!mounted) return;
      setSchedule(gamesPayload.data.map(mapApiGame));
      setAccount(accountPayload.data);
      setAuthenticated(accountPayload.meta.authenticated);
      setOnboardingOpen(accountPayload.meta.authenticated && !accountPayload.meta.onboardingCompleted);
      setPreferences(preferencesPayload.data);
      setFeedItems(feedPayload.data);
      setTeams(catalogPayload.data.teams);
      setPlayers(catalogPayload.data.players);
      setDiscovery(discoveryPayload.data);
      setCatchUpBrief(catchUpPayload.data);
      setNotifications(alertsPayload.data);
      setSavedArticles(savedPayload.data);
    }).catch(() => {
      if (mounted) setPreferenceStatus("Could not load your saved personalization. Showing local defaults.");
    }).finally(() => {
      if (mounted) setPersonalizationLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedGameId) return;
    let mounted = true;

    const refreshGameCenter = async (quiet = false) => {
      if (quiet) setGameCenterRefreshing(true);
      else setGameCenterLoading(true);
      try {
        const payload = await fetchJson<{ data: GameCenterData }>(`/api/games/${encodeURIComponent(selectedGameId)}`);
        if (!mounted) return;
        setGameCenter(payload.data);
        setGameCenterError("");
        const updatedGame = mapApiGame(payload.data.game);
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
    const interval = window.setInterval(() => void refreshGameCenter(true), 15_000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [selectedGameId, gameCenterRefreshKey]);

  const persistPreferences = async (next: Preferences) => {
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
        fetchJson<{ data: CatchUpBrief }>("/api/catch-up"),
        fetchJson<{ data: DeliveredAlert[] }>("/api/alerts", { method: "POST" }).then(() => fetchJson<{ data: DeliveredAlert[] }>("/api/alerts")),
      ]);
      setFeedItems(feedPayload.data);
      setDiscovery(discoveryPayload.data);
      setCatchUpBrief(catchUpPayload.data);
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
  const markAllNotificationsRead = async () => {
    await fetchJson("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true, readAt: notification.readAt ?? new Date().toISOString() })));
  };
  const signOut = async () => {
    await fetchJson("/api/auth/logout", { method: "POST" });
    window.location.reload();
  };

  const calendarMonths = useMemo(() => {
    const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endYear = today.getMonth() <= 5 ? today.getFullYear() : today.getFullYear() + 1;
    const endMonth = new Date(endYear, 5, 1);
    const months: Date[] = [];
    const cursor = new Date(firstMonth);
    while (cursor <= endMonth) { months.push(new Date(cursor)); cursor.setMonth(cursor.getMonth() + 1); }
    return months;
  }, [today]);

  const selectedMonth = calendarMonths[selectedMonthIndex] ?? calendarMonths[0];
  const followedTeams = teams.filter((team) => preferences.followedTeamIds.includes(team.id));
  const followedPlayers = players.filter((player) => preferences.followedPlayerIds.includes(player.id));
  const hasPersonalization = preferences.followedTeamIds.length > 0 || preferences.followedPlayerIds.length > 0;
  const followedScheduleTeamIds = new Set([...preferences.followedTeamIds, ...followedPlayers.map((player) => player.teamId)]);
  const popularGameOrder = new Map(discovery.games.map((recommendation, index) => [recommendation.game.id, index]));
  const teamOptions = ["All teams", ...teams.map((team) => team.name)];
  const selectedDay = new Date(`${selectedDate}T12:00:00`);
  const filteredSchedule = useMemo(() => schedule.filter((game) => {
    if (scheduleTeam !== "All teams") return game.home === scheduleTeam || game.away === scheduleTeam;
    if (hasPersonalization) return followedScheduleTeamIds.has(game.homeId) || followedScheduleTeamIds.has(game.awayId);
    return popularGameOrder.size === 0 || popularGameOrder.has(game.id);
  }), [hasPersonalization, followedScheduleTeamIds, popularGameOrder, schedule, scheduleTeam]);
  const rangeForView = (view: ScheduleView) => {
    if (view === "day") return { start: selectedDay, end: addDays(selectedDay, 1) };
    if (view === "week") { const start = startOfWeek(selectedDay); return { start, end: addDays(start, 7) }; }
    return { start: selectedMonth, end: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1) };
  };
  const range = rangeForView(scheduleView);
  const soonestGames = filteredSchedule.filter((game) => { const date = new Date(`${game.date}T12:00:00`); return date >= range.start && date < range.end; }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const liveGames = schedule.filter((game) => game.status === "live");
  const featuredLiveGame = liveGames.find((game) => preferences.followedTeamIds.includes(game.homeId) || preferences.followedTeamIds.includes(game.awayId)) ?? liveGames[0];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const homeUpcomingGames = filteredSchedule.filter((game) => game.status === "scheduled" && new Date(`${game.date}T12:00:00`) >= today).sort((a, b) => hasPersonalization ? a.date.localeCompare(b.date) : (popularGameOrder.get(a.id) ?? 999) - (popularGameOrder.get(b.id) ?? 999) || a.date.localeCompare(b.date)).slice(0, 2);
  const monthDays = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const monthStartDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  const calendarBlanks = (monthStartDay + 6) % 7;
  const calendarCells = Array.from({ length: calendarBlanks + monthDays }, (_, index) => index < calendarBlanks ? null : index - calendarBlanks + 1);
  const gamesForDate = (dateKey: string) => filteredSchedule.filter((game) => game.date === dateKey);

  const moveMonth = (amount: number) => { const nextIndex = selectedMonthIndex + amount; if (nextIndex < 0 || nextIndex >= calendarMonths.length) return; setSelectedMonthIndex(nextIndex); setSelectedDate(toDateKey(calendarMonths[nextIndex])); };
  const openGameCenter = (gameId: string) => { setSelectedGameId(gameId); setGameCenter(null); setGameCenterError(""); setActiveNav("Live games"); };
  const closeGameCenter = () => { setSelectedGameId(null); setGameCenter(null); setGameCenterError(""); };
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
      const payload = await fetchJson<{ data: CatchUpBrief }>(gameId ? `/api/catch-up?gameId=${encodeURIComponent(gameId)}` : "/api/catch-up");
      setCatchUpBrief(payload.data);
      setCatchUpOpen(true);
    } catch (catchUpError) {
      if (!gameId && catchUpBrief) setCatchUpOpen(true);
      else setGameCenterError(catchUpError instanceof Error ? catchUpError.message : "Could not build this catch-up.");
    } finally {
      setCatchUpLoading(false);
    }
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-dot" />courtside</div>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="main-nav" aria-label="Main navigation">{["Home", "Schedule", "Live games", "My teams", "My players", "Saved"].map((item) => <button className={activeNav === item || (item === "My teams" && activeNav === "Team profile") || (item === "My players" && activeNav === "Player profile") || (item === "Saved" && activeNav === "Article" && articleBackNav === "Saved") ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)} key={item}><span className="nav-icon">{item === "Home" ? "⌂" : item === "Schedule" ? "▦" : item === "Live games" ? "◉" : item === "My teams" ? "◈" : item === "My players" ? "♙" : "◇"}</span>{item}{item === "Live games" && liveGames.length > 0 && <span className="live-pill">{liveGames.length}</span>}{item === "Saved" && savedArticles.length > 0 && <span className="saved-pill">{savedArticles.length}</span>}</button>)}</nav>
      <div className="sidebar-section-label following-label">Following</div>
      <div className="following-list">{followedTeams.slice(0, 2).map((team) => <button className="following-row following-team" key={team.id} onClick={() => void openTeamProfile(team.id)}><TeamMark short={team.short} color={team.color} /><span>{team.name.replace(/^(Golden State|New York|Oklahoma City) /, "")}</span></button>)}{followedPlayers.slice(0, 2).map((player) => <button className="following-row following-player" key={player.id} onClick={() => void openPlayerProfile(player.id)}><span className="avatar small-avatar" style={{ background: player.color }}>{player.initials}</span><span>{player.name}</span></button>)}{followedTeams.length === 0 && followedPlayers.length === 0 && <div className="following-empty">Nothing followed yet</div>}<button className="add-following" onClick={() => setActiveNav("My teams")}>＋ Manage following</button></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setActiveNav("My teams")}><span className="nav-icon">⚙</span>Preferences</button><div className="profile"><span className="avatar profile-avatar">{initialsFor(account.displayName)}</span><span><strong>{account.displayName}</strong><small>{authenticated ? account.email : "Shared demo mode"}</small></span>{authenticated ? <button className="profile-action" onClick={() => void signOut()}>Sign out</button> : <button className="profile-action" onClick={() => setAuthOpen(true)}>Sign in</button>}</div></div>
    </aside>

    <section className="content-area">
      <header className="topbar"><div className="mobile-brand"><span className="brand-dot" />courtside</div><div className="date-label">{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div><div className="top-actions">{!authenticated && <button className="top-auth-button" onClick={() => setAuthOpen(true)}>Sign in</button>}<button className="icon-button" aria-label="Search">⌕</button><div className="notification-menu"><button className="notification-button" aria-label={`${unreadCount} unread notifications`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧{unreadCount > 0 && <span />}</button>{notificationsOpen && <section className="notification-panel" aria-label="Notifications"><div className="notification-header"><div><p className="overline">ALERT INBOX</p><h2>Notifications</h2></div>{unreadCount > 0 && <button onClick={() => void markAllNotificationsRead()}>Mark all read</button>}</div>{notifications.length > 0 ? <div className="notification-list">{notifications.map((notification) => <article className={notification.read ? "notification-row read" : "notification-row"} key={notification.id}><span className="notification-kind">{alertIcons[notification.type]}</span><div><p>{alertLabels[notification.type]} · {formatRelativeTime(notification.deliveredAt)}</p><strong>{notification.title}</strong><span>{notification.body}</span></div></article>)}</div> : <div className="notification-empty">No alerts yet. The worker will add important updates here.</div>}</section>}</div></div></header>
      <nav className="mobile-nav" aria-label="Mobile navigation">{[["Home", "⌂"], ["Schedule", "▦"], ["Live games", "◉"], ["My teams", "◈"], ["My players", "♙"], ["Saved", "◇"]].map(([item, icon]) => <button className={activeNav === item || (item === "My teams" && activeNav === "Team profile") || (item === "My players" && activeNav === "Player profile") || (item === "Saved" && activeNav === "Article" && articleBackNav === "Saved") ? "active" : ""} onClick={() => setActiveNav(item)} key={item}><span>{icon}</span>{item === "Live games" ? "Live" : item === "My teams" ? "Teams" : item === "My players" ? "Players" : item}</button>)}</nav>

      {activeNav === "Home" ? <>
        <div className="welcome-row"><div><p className="overline">YOUR NBA, IN FOCUS</p><h1>Good morning, {account.displayName.split(" ")[0]} <span>✦</span></h1><p className="subhead">Here&apos;s what matters across the teams and players you follow.</p></div><button className="catch-up-button" onClick={() => void openCatchUp()} disabled={!catchUpBrief || catchUpLoading}><span>✦</span><span><strong>{catchUpLoading ? "Building recap…" : "Catch me up"}</strong><small>{catchUpBrief?.readTimeMinutes ?? 1} min read</small></span><b>→</b></button></div>
        <div className="dashboard-grid"><div className="feed-column"><div className="section-heading"><div><h2>{hasPersonalization ? "Your feed" : "Popular right now"}</h2><p className="feed-subtitle">{hasPersonalization ? "Ranked for your current favorites" : "League-wide stories to get you started"}</p></div><span className="feed-count">{feedItems.length} updates</span></div><div className="feed-list">{personalizationLoading ? <div className="feed-state">Building your personalized feed…</div> : feedItems.length === 0 ? <div className="feed-state"><strong>No current NBA stories are available.</strong><span>Fresh updates will appear here after the next data sync.</span><button onClick={() => setActiveNav("My teams")}>Choose favorites</button></div> : feedItems.map((item) => <article className={`feed-card ${item.accent}`} key={item.id}><div className="feed-icon">{item.kind === "performance" ? "◉" : item.kind === "injury" ? "!" : "✦"}</div><div className="feed-content"><div className="feed-card-top"><p className="card-eyebrow">{item.eyebrow} · {formatRelativeTime(item.publishedAt)}</p><span className="relevance-score">{item.relevanceScore}% {hasPersonalization ? "match" : "popular"}</span></div><h3>{item.title}</h3><p className="card-body">{item.body}</p><div className="feed-meta"><span>{item.reason}</span><button onClick={() => void openArticle(item.id, "Home")}>Read story <span>→</span></button></div></div></article>)}</div></div>
          <div className="right-column">
            {featuredLiveGame ? <LiveGameCard game={featuredLiveGame} onOpen={() => openGameCenter(featuredLiveGame.id)} /> : <section className="section-card"><div className="mini-empty">There are no live games right now.</div></section>}
            <section className="section-card"><div className="section-heading compact"><h2>{hasPersonalization ? "Upcoming for you" : "Popular upcoming games"}</h2><button className="text-button" onClick={() => setActiveNav("Schedule")}>View schedule <span>→</span></button></div>{homeUpcomingGames.length > 0 ? homeUpcomingGames.map((game) => { const gameDate = new Date(`${game.date}T12:00:00`); return <div className="upcoming-game" key={game.id}><div className="upcoming-date"><strong>{gameDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong><span>{gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</span></div><div className="upcoming-teams"><div><TeamMark short={game.awayShort} color={game.awayColor} /><span>{game.awayShort}</span></div><b>{game.time}</b><div><TeamMark short={game.homeShort} color={game.homeColor} /><span>{game.homeShort}</span></div></div><span className="tv-badge">{game.network}</span></div>; }) : <div className="mini-empty">There are no upcoming games available.</div>}</section>
            <section className="section-card alerts-card"><div className="section-heading compact"><div><h2>Your alerts</h2><p>Stay close to what matters.</p></div><span className={preferencesSaving ? "save-state saving" : "save-state"}>{preferencesSaving ? "Saving…" : "Synced"}</span></div>{([['gameStarting', 'Game starting', '30 minutes before tip-off'], ['closeGame', 'Close game', 'Within 5 points in the 4th or a decisive late play'], ['finalScore', 'Final score', 'As soon as the game ends'], ['injuryUpdate', 'Injury updates', 'When availability changes during a game'], ['leadChange', 'Late lead changes', 'When the lead flips in the 4th quarter'], ['milestone', 'Player milestones', 'Notable achievements during live games'], ['standoutPerformance', 'Standout performances', 'For your favorite players']] as Array<[keyof AlertPreferences, string, string]>).map(([key, title, detail]) => <div className="alert-row" key={key}><span className="alert-icon">{alertIcons[key]}</span><span><strong>{title}</strong><small>{detail}</small></span><button aria-label={`Toggle ${title}`} aria-pressed={preferences.alerts[key]} className={preferences.alerts[key] ? "toggle on" : "toggle"} disabled={preferencesSaving} onClick={() => toggleAlert(key)}><i /></button></div>)}</section>
          </div>
        </div>
      </> : activeNav === "Schedule" ? <>
        <div className="page-heading schedule-heading"><p className="overline">{hasPersonalization ? "YOUR UPCOMING GAMES" : "POPULAR UPCOMING GAMES"}</p><h1>Schedule</h1><p className="subhead">{hasPersonalization ? "Plan around the games you care about, from now through the end of the playoffs." : "Explore high-visibility NBA games while you choose teams and players to follow."}</p></div>
        <div className="schedule-layout"><section className="calendar-panel"><div className="schedule-panel-header"><div><p className="overline">CALENDAR</p><h2>{formatMonth(selectedMonth)}</h2></div><div className="month-controls"><button onClick={() => moveMonth(-1)} disabled={selectedMonthIndex === 0} aria-label="Previous month">←</button><button onClick={() => moveMonth(1)} disabled={selectedMonthIndex === calendarMonths.length - 1} aria-label="Next month">→</button></div></div><div className="calendar-filter-row"><label htmlFor="schedule-team">Show games for</label><select id="schedule-team" value={scheduleTeam} onChange={(event) => setScheduleTeam(event.target.value)}>{teamOptions.map((team) => <option key={team}>{team}</option>)}</select><span className="calendar-range">{formatMonth(calendarMonths[0])} — {formatMonth(calendarMonths[calendarMonths.length - 1])}</span></div><div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarCells.map((day, index) => { const dateKey = day ? toDateKey(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day)) : `blank-${index}`; const dayGames = day ? gamesForDate(dateKey) : []; const isSelected = dateKey === selectedDate; const isToday = dateKey === toDateKey(today); return <button className={day ? `calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}` : "calendar-day blank"} key={dateKey} disabled={!day} onClick={() => { if (day) { setSelectedDate(dateKey); setScheduleView("day"); } }}>{day && <><span className="calendar-day-number">{day}</span>{dayGames.length > 0 && <span className="calendar-game-dot" title={`${dayGames.length} game${dayGames.length === 1 ? "" : "s"}`}><i />{dayGames.length}</span>}{dayGames.slice(0, 2).map((game) => <span className="calendar-game-label" key={game.id}>{game.homeShort} <b>·</b> {game.awayShort}</span>)}</>}</button>; })}</div><div className="selected-date-summary"><div><p className="overline">SELECTED DAY</p><h3>{formatShortDate(selectedDay)}</h3></div><span>{gamesForDate(selectedDate).length} game{gamesForDate(selectedDate).length === 1 ? "" : "s"}</span></div>{gamesForDate(selectedDate).length > 0 ? <div className="selected-day-games">{gamesForDate(selectedDate).map((game) => <GameRow game={game} key={game.id} />)}</div> : <div className="empty-schedule compact-empty"><span>◌</span><strong>No games available</strong><small>Try another day or team filter.</small></div>}</section><aside className="soonest-panel"><div className="section-heading compact"><div><p className="overline">QUICK VIEW</p><h2>Soonest games</h2></div><span className="schedule-count">{filteredSchedule.length} total</span></div><div className="schedule-view-tabs" role="tablist" aria-label="Soonest games range">{(["day", "week", "month"] as ScheduleView[]).map((view) => <button className={scheduleView === view ? "active" : ""} key={view} onClick={() => setScheduleView(view)}>{view}</button>)}</div><p className="soonest-description">Showing games for {scheduleView === "day" ? formatShortDate(selectedDay) : scheduleView === "week" ? `the week of ${formatShortDate(range.start)}` : formatMonth(selectedMonth)}.</p>{soonestGames.length > 0 ? <div className="soonest-list">{soonestGames.map((game) => <GameRow game={game} key={game.id} />)}</div> : <div className="empty-schedule"><span>◌</span><strong>No games available</strong><small>There are no upcoming games in this category.</small></div>}<button className="schedule-reset" onClick={() => { setScheduleTeam("All teams"); setScheduleView("month"); setSelectedMonthIndex(0); setSelectedDate(toDateKey(calendarMonths[0])); }}>Reset schedule view <span>↺</span></button></aside></div>
      </> : activeNav === "Article" ? <ArticleDetailView article={articleDetail} loading={articleLoading} error={articleError} saved={Boolean(selectedArticleId && savedArticles.some((article) => article.id === selectedArticleId))} saving={savingArticleId === selectedArticleId} backLabel={articleBackNav === "Saved" ? "Saved stories" : articleBackNav === "Team profile" ? "Team profile" : "Home"} teams={teams} players={players} onBack={() => setActiveNav(articleBackNav)} onRetry={() => { if (selectedArticleId) void openArticle(selectedArticleId, articleBackNav); }} onToggleSave={() => void toggleArticleSave()} onOpenTeam={(teamId) => void openTeamProfile(teamId)} onOpenPlayer={(playerId) => void openPlayerProfile(playerId)} /> : activeNav === "Saved" ? <SavedStoriesView articles={savedArticles} savingArticleId={savingArticleId} error={savedArticlesError} onOpen={(articleId) => void openArticle(articleId, "Saved")} onRemove={(articleId) => void removeSavedStory(articleId)} /> : activeNav === "Team profile" ? <TeamProfileView profile={teamProfile} loading={teamProfileLoading} error={teamProfileError} isFollowed={Boolean(selectedTeamId && preferences.followedTeamIds.includes(selectedTeamId))} onBack={() => setActiveNav("My teams")} onRetry={() => { if (selectedTeamId) void openTeamProfile(selectedTeamId); }} onToggleFollow={() => { if (selectedTeamId) toggleTeam(selectedTeamId); }} onOpenPlayer={(playerId) => void openPlayerProfile(playerId)} onOpenGame={openGameCenter} onOpenArticle={(articleId) => void openArticle(articleId, "Team profile")} /> : activeNav === "My teams" ? <>
        <div className="page-heading"><p className="overline">PERSONALIZE YOUR EXPERIENCE</p><h1>My teams</h1><p className="subhead">Choose the teams that should shape your feed, schedule, and alerts.</p>{preferenceStatus && <p className={preferenceStatus.startsWith("Save failed") || preferenceStatus.startsWith("Could not") ? "preference-status error" : "preference-status"}>{preferenceStatus}</p>}</div>
        <section className="preferences-panel">
          <div className="preference-block"><div className="section-heading"><div><h2>Your teams</h2><p className="panel-copy">Teams you follow and use to personalize your experience.</p></div><span className="count-badge">{followedTeams.length} followed</span></div><div className="preference-list">{followedTeams.length > 0 ? followedTeams.map((team) => <div className="preference-row selected team-preference-row" key={team.id}><button className="team-row-profile" onClick={() => void openTeamProfile(team.id)}><TeamMark short={team.short} color={team.color} /><span><strong>{team.name}</strong><small>{team.record} record</small></span></button><button className="row-follow-action" disabled={preferencesSaving} onClick={() => toggleTeam(team.id)}>Unfollow</button></div>) : <div className="discovery-empty">You are not following any teams yet. Add one from the recommendations.</div>}</div></div>
          <div className="preference-block recommendation-block"><div className="section-heading"><div><h2>{hasPersonalization ? "Teams you may like" : "Popular teams"}</h2><p className="panel-copy">{hasPersonalization ? "Personalized candidates first, then popular teams to fill up to eight spots." : "Trending across current coverage and nationally visible games."}</p></div><span className="count-badge">{discovery.teams.length}/8</span></div><div className="preference-list">{discovery.teams.length > 0 ? discovery.teams.slice(0, 8).map(({ team, score, reason }) => <div className="recommendation-row team-recommendation-row" key={team.id}><button className="recommendation-profile team-recommendation-profile" onClick={() => void openTeamProfile(team.id)}><TeamMark short={team.short} color={team.color} /><span><strong>{team.name}</strong><small>{reason}</small></span></button><span className="recommendation-score">{score}%</span><button disabled={preferencesSaving} onClick={() => toggleTeam(team.id)}>Follow</button></div>) : <div className="discovery-empty">You already follow every available team recommendation.</div>}</div></div>
        </section>
      </> : activeNav === "Player profile" ? <PlayerProfileView profile={playerProfile} loading={playerProfileLoading} error={playerProfileError} isFollowed={Boolean(selectedPlayerId && preferences.followedPlayerIds.includes(selectedPlayerId))} onBack={() => setActiveNav("My players")} onRetry={() => { if (selectedPlayerId) void openPlayerProfile(selectedPlayerId); }} onToggleFollow={() => { if (selectedPlayerId) togglePlayer(selectedPlayerId); }} /> : activeNav === "My players" ? <>
        <div className="page-heading"><p className="overline">PERSONALIZE YOUR EXPERIENCE</p><h1>My players</h1><p className="subhead">Follow players to prioritize their performances, injuries, and storylines.</p>{preferenceStatus && <p className={preferenceStatus.startsWith("Save failed") || preferenceStatus.startsWith("Could not") ? "preference-status error" : "preference-status"}>{preferenceStatus}</p>}</div>
        <section className="preferences-panel">
          <div className="preference-block"><div className="section-heading"><div><h2>Your players</h2><p className="panel-copy">Players you follow and use to personalize your experience.</p></div><span className="count-badge">{followedPlayers.length} followed</span></div><div className="preference-list">{followedPlayers.length > 0 ? followedPlayers.map((player) => <div className="preference-row selected player-preference-row" key={player.id}><button className="player-row-profile" onClick={() => void openPlayerProfile(player.id)}><span className="avatar preference-avatar" style={{ background: player.color }}>{player.initials}</span><span><strong>{player.name}</strong><small>{player.teamName} · {player.position}</small></span></button><button className="row-follow-action" disabled={preferencesSaving} onClick={() => togglePlayer(player.id)}>Unfollow</button></div>) : <div className="discovery-empty">You are not following any players yet. Add one from the recommendations.</div>}</div></div>
          <div className="preference-block recommendation-block"><div className="section-heading"><div><h2>{hasPersonalization ? "Players you may like" : "Popular players"}</h2><p className="panel-copy">{hasPersonalization ? "Personalized candidates first, then popular players to fill up to eight spots." : "Trending across recent NBA updates and high-visibility matchups."}</p></div><span className="count-badge">{discovery.players.length}/8</span></div><div className="preference-list">{discovery.players.length > 0 ? discovery.players.slice(0, 8).map(({ player, score, reason }) => <div className="recommendation-row player-recommendation-row" key={player.id}><button className="recommendation-profile" onClick={() => void openPlayerProfile(player.id)}><span className="avatar preference-avatar" style={{ background: player.color }}>{player.initials}</span><span><strong>{player.name}</strong><small>{reason}</small></span></button><span className="recommendation-score">{score}%</span><button disabled={preferencesSaving} onClick={() => togglePlayer(player.id)}>Follow</button></div>) : <div className="discovery-empty">You already follow every available player recommendation.</div>}</div></div>
        </section>
      </> : <>
        <div className="page-heading"><p className="overline">GAME CENTER</p><h1>Live games</h1><p className="subhead">Follow scores, every play, and the moments changing the game.</p></div>{liveGames.length > 0 ? <section className="live-games-grid">{liveGames.map((game) => <LiveGameCard game={game} key={game.id} onOpen={() => openGameCenter(game.id)} />)}</section> : !selectedGameId && <section className="feed-state"><strong>No games are live right now.</strong><span>Upcoming games are still available in your schedule.</span><button onClick={() => setActiveNav("Schedule")}>View schedule</button></section>}{selectedGameId && <GameCenterPanel center={gameCenter} loading={gameCenterLoading} refreshing={gameCenterRefreshing} catchUpLoading={catchUpLoading} error={gameCenterError} onClose={closeGameCenter} onRetry={() => setGameCenterRefreshKey((key) => key + 1)} onCatchUp={() => void openCatchUp(selectedGameId)} />}
      </>}
    </section>

    {catchUpOpen && catchUpBrief && <div className="modal-backdrop" onClick={() => setCatchUpOpen(false)}><section className="catch-up-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCatchUpOpen(false)}>×</button><p className="overline">YOUR {catchUpBrief.readTimeMinutes}-MINUTE CATCH-UP</p><h2>{catchUpBrief.title}</h2><p className="modal-lede">{catchUpBrief.lede}</p><div className="catch-up-source"><i />{catchUpBrief.source === "play-by-play" ? "Built from live play-by-play" : "Built from the latest NBA coverage"}</div>{catchUpBrief.game && <div className="recap-stat-row"><div><strong>{catchUpBrief.game.awayScore ?? "—"}–{catchUpBrief.game.homeScore ?? "—"}</strong><span>{catchUpBrief.game.away.short} at {catchUpBrief.game.home.short}</span></div><div><strong>{catchUpBrief.game.status === "live" ? (catchUpBrief.game.period && catchUpBrief.game.period > 4 ? `OT${catchUpBrief.game.period - 4}` : `Q${catchUpBrief.game.period ?? "—"}`) : "FINAL"}</strong><span>{catchUpBrief.game.status === "live" ? catchUpBrief.game.clock ?? "Live" : "Game status"}</span></div><div><strong>{catchUpBrief.moments.length}</strong><span>Key updates</span></div></div>}<h3>{catchUpBrief.moments.length} updates that matter most</h3><ol className="moment-list">{catchUpBrief.moments.map((moment, index) => <li key={moment.id}><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{moment.title}.</strong> {moment.detail}{moment.context && <small className="moment-context">{moment.context}</small>}<small>{moment.reason}</small></p></li>)}</ol><button className="modal-action" onClick={() => setCatchUpOpen(false)}>Back to my feed <span>→</span></button></section></div>}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    {onboardingOpen && <OnboardingModal teams={teams} players={players} recommendedTeamIds={discovery.teams.map(({ team }) => team.id)} recommendedPlayerIds={discovery.players.map(({ player }) => player.id)} initialPreferences={preferences} />}
  </main>;
}

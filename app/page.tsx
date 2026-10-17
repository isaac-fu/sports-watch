"use client";

import { useEffect, useMemo, useState } from "react";

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
type AlertPreferences = { gameStarting: boolean; closeGame: boolean; finalScore: boolean; standoutPerformance: boolean };
type Preferences = { followedTeamIds: string[]; followedPlayerIds: string[]; alerts: AlertPreferences };

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
};

type ApiGame = {
  id: string;
  date: string;
  time: string;
  network: string;
  venue: string;
  home: { id: string; name: string; short: string; color: string };
  away: { id: string; name: string; short: string; color: string };
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
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
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
    return { id: `game-${index + 1}`, date: toDateKey(gameDate), homeId: matchup[1].toLowerCase(), home: matchup[0], homeShort: matchup[1], homeColor: matchup[2], awayId: matchup[4].toLowerCase(), away: matchup[3], awayShort: matchup[4], awayColor: matchup[5], time: matchup[6], network: matchup[7], venue: matchup[8] };
  });
};

const mapApiGame = (game: ApiGame): Game => ({ id: game.id, date: game.date, time: game.time, network: game.network, venue: game.venue, homeId: game.home.id, home: game.home.name, homeShort: game.home.short, homeColor: game.home.color, awayId: game.away.id, away: game.away.name, awayShort: game.away.short, awayColor: game.away.color });

function TeamMark({ short, color }: { short: string; color: string }) {
  return <span className="team-mark" style={{ background: color }}>{short}</span>;
}

function GameRow({ game }: { game: Game }) {
  const gameDate = new Date(`${game.date}T12:00:00`);
  return <article className="schedule-game-row"><div className="schedule-game-date"><strong>{gameDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong><span>{gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div><div className="schedule-matchup"><div><TeamMark short={game.awayShort} color={game.awayColor} /><span>{game.away}</span></div><b>at</b><div><TeamMark short={game.homeShort} color={game.homeColor} /><span>{game.home}</span></div></div><div className="schedule-game-time"><strong>{game.time}</strong><span>{game.network}</span></div></article>;
}

export default function Home() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const fallbackSchedule = useMemo(() => buildSchedule(), []);
  const [schedule, setSchedule] = useState<Game[]>(fallbackSchedule);
  const [teams, setTeams] = useState<Team[]>(defaultTeams);
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [account, setAccount] = useState<Account>({ id: "account-demo", displayName: "Alex Morgan", email: "", timezone: "America/Los_Angeles", createdAt: "" });
  const [preferences, setPreferences] = useState<Preferences>({ followedTeamIds: ["gsw"], followedPlayerIds: ["stephen-curry"], alerts: { gameStarting: true, closeGame: true, finalScore: true, standoutPerformance: false } });
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [personalizationLoading, setPersonalizationLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const [activeNav, setActiveNav] = useState("Home");
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("month");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [scheduleTeam, setScheduleTeam] = useState("All teams");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson<{ data: ApiGame[] }>("/api/games"),
      fetchJson<{ data: Account }>("/api/account"),
      fetchJson<{ data: Preferences }>("/api/preferences"),
      fetchJson<{ data: FeedItem[] }>("/api/feed"),
      fetchJson<{ data: { teams: Team[]; players: Player[] } }>("/api/catalog"),
    ]).then(([gamesPayload, accountPayload, preferencesPayload, feedPayload, catalogPayload]) => {
      if (!mounted) return;
      setSchedule(gamesPayload.data.map(mapApiGame));
      setAccount(accountPayload.data);
      setPreferences(preferencesPayload.data);
      setFeedItems(feedPayload.data);
      setTeams(catalogPayload.data.teams);
      setPlayers(catalogPayload.data.players);
    }).catch(() => {
      if (mounted) setPreferenceStatus("Could not load your saved personalization. Showing local defaults.");
    }).finally(() => {
      if (mounted) setPersonalizationLoading(false);
    });
    return () => { mounted = false; };
  }, []);

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
      const feedPayload = await fetchJson<{ data: FeedItem[] }>("/api/feed");
      setFeedItems(feedPayload.data);
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
  const teamOptions = ["All teams", ...teams.map((team) => team.name)];
  const selectedDay = new Date(`${selectedDate}T12:00:00`);
  const filteredSchedule = useMemo(() => schedule.filter((game) => scheduleTeam === "All teams" ? preferences.followedTeamIds.length > 0 && (preferences.followedTeamIds.includes(game.homeId) || preferences.followedTeamIds.includes(game.awayId)) : game.home === scheduleTeam || game.away === scheduleTeam), [preferences.followedTeamIds, schedule, scheduleTeam]);
  const rangeForView = (view: ScheduleView) => {
    if (view === "day") return { start: selectedDay, end: addDays(selectedDay, 1) };
    if (view === "week") { const start = startOfWeek(selectedDay); return { start, end: addDays(start, 7) }; }
    return { start: selectedMonth, end: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1) };
  };
  const range = rangeForView(scheduleView);
  const soonestGames = filteredSchedule.filter((game) => { const date = new Date(`${game.date}T12:00:00`); return date >= range.start && date < range.end; }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const homeUpcomingGames = filteredSchedule.filter((game) => new Date(`${game.date}T12:00:00`) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  const monthDays = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const monthStartDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  const calendarBlanks = (monthStartDay + 6) % 7;
  const calendarCells = Array.from({ length: calendarBlanks + monthDays }, (_, index) => index < calendarBlanks ? null : index - calendarBlanks + 1);
  const gamesForDate = (dateKey: string) => filteredSchedule.filter((game) => game.date === dateKey);

  const moveMonth = (amount: number) => { const nextIndex = selectedMonthIndex + amount; if (nextIndex < 0 || nextIndex >= calendarMonths.length) return; setSelectedMonthIndex(nextIndex); setSelectedDate(toDateKey(calendarMonths[nextIndex])); };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-dot" />courtside</div>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="main-nav" aria-label="Main navigation">{["Home", "Schedule", "Live games", "My teams", "My players"].map((item) => <button className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)} key={item}><span className="nav-icon">{item === "Home" ? "⌂" : item === "Schedule" ? "▦" : item === "Live games" ? "◉" : item === "My teams" ? "◈" : "♙"}</span>{item}{item === "Live games" && <span className="live-pill">3</span>}</button>)}</nav>
      <div className="sidebar-section-label following-label">Following</div>
      <div className="following-list">{followedTeams.slice(0, 2).map((team) => <div className="following-row" key={team.id}><TeamMark short={team.short} color={team.color} /><span>{team.name.replace(/^(Golden State|New York|Oklahoma City) /, "")}</span></div>)}{followedPlayers.slice(0, 2).map((player) => <div className="following-row" key={player.id}><span className="avatar small-avatar" style={{ background: player.color }}>{player.initials}</span><span>{player.name}</span></div>)}{followedTeams.length === 0 && followedPlayers.length === 0 && <div className="following-empty">Nothing followed yet</div>}<button className="add-following" onClick={() => setActiveNav("My teams")}>＋ Manage following</button></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setActiveNav("My teams")}><span className="nav-icon">⚙</span>Preferences</button><div className="profile"><span className="avatar profile-avatar">{initialsFor(account.displayName)}</span><span><strong>{account.displayName}</strong><small>Personal account</small></span><span className="more">•••</span></div></div>
    </aside>

    <section className="content-area">
      <header className="topbar"><div className="mobile-brand"><span className="brand-dot" />courtside</div><div className="date-label">{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div><div className="top-actions"><button className="icon-button" aria-label="Search">⌕</button><button className="notification-button" aria-label="Notifications">♧<span /></button></div></header>

      {activeNav === "Home" ? <>
        <div className="welcome-row"><div><p className="overline">YOUR NBA, IN FOCUS</p><h1>Good morning, {account.displayName.split(" ")[0]} <span>✦</span></h1><p className="subhead">Here&apos;s what matters across the teams and players you follow.</p></div><button className="catch-up-button" onClick={() => setCatchUpOpen(true)}><span>✦</span><span><strong>Catch me up</strong><small>3 min read</small></span><b>→</b></button></div>
        <div className="dashboard-grid"><div className="feed-column"><div className="section-heading"><div><h2>Your feed</h2><p className="feed-subtitle">Ranked for your current favorites</p></div><span className="feed-count">{feedItems.length} updates</span></div><div className="feed-list">{personalizationLoading ? <div className="feed-state">Building your personalized feed…</div> : feedItems.length === 0 ? <div className="feed-state"><strong>Your feed is ready for favorites.</strong><span>Follow a team or player to see relevant stories here.</span><button onClick={() => setActiveNav("My teams")}>Choose favorites</button></div> : feedItems.map((item) => <article className={`feed-card ${item.accent}`} key={item.id}><div className="feed-icon">{item.kind === "performance" ? "◉" : item.kind === "injury" ? "!" : "✦"}</div><div className="feed-content"><div className="feed-card-top"><p className="card-eyebrow">{item.eyebrow} · {formatRelativeTime(item.publishedAt)}</p><span className="relevance-score">{item.relevanceScore}% match</span></div><h3>{item.title}</h3><p className="card-body">{item.body}</p><div className="feed-meta"><span>{item.reason}</span><button>Read story <span>→</span></button></div></div></article>)}</div></div>
          <div className="right-column"><section className="game-card"><div className="game-card-header"><div><p className="overline light">LIVE NOW</p><span className="game-status"><i /> 4th quarter · 08:42</span></div><button className="more-button">•••</button></div><div className="matchup"><div className="team-score"><TeamMark short="GSW" color="#f3b942" /><strong>118</strong><span>Golden State</span></div><div className="score-divider">—</div><div className="team-score"><TeamMark short="SAC" color="#7654a8" /><strong>112</strong><span>Sacramento</span></div></div><div className="game-card-footer"><span>NBA · Golden 1 Center</span><button onClick={() => setActiveNav("Live games")}>Open game center <span>↗</span></button></div></section><section className="section-card"><div className="section-heading compact"><h2>Upcoming for you</h2><button className="text-button" onClick={() => setActiveNav("Schedule")}>View schedule <span>→</span></button></div>{homeUpcomingGames.length > 0 ? homeUpcomingGames.map((game) => { const gameDate = new Date(`${game.date}T12:00:00`); return <div className="upcoming-game" key={game.id}><div className="upcoming-date"><strong>{gameDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong><span>{gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</span></div><div className="upcoming-teams"><div><TeamMark short={game.awayShort} color={game.awayColor} /><span>{game.awayShort}</span></div><b>{game.time}</b><div><TeamMark short={game.homeShort} color={game.homeColor} /><span>{game.homeShort}</span></div></div><span className="tv-badge">{game.network}</span></div>; }) : <div className="mini-empty">Follow a team to see upcoming games.</div>}</section><section className="section-card alerts-card"><div className="section-heading compact"><div><h2>Your alerts</h2><p>Stay close to what matters.</p></div><span className={preferencesSaving ? "save-state saving" : "save-state"}>{preferencesSaving ? "Saving…" : "Synced"}</span></div>{([['gameStarting', 'Game starting', '30 minutes before tip-off'], ['closeGame', 'Close game', 'Within 5 points in the 4th'], ['finalScore', 'Final score', 'As soon as the game ends'], ['standoutPerformance', 'Standout performances', 'For your favorite players']] as Array<[keyof AlertPreferences, string, string]>).map(([key, title, detail]) => <div className="alert-row" key={key}><span className="alert-icon">{key === "gameStarting" ? "◷" : key === "closeGame" ? "⌁" : key === "finalScore" ? "✓" : "✦"}</span><span><strong>{title}</strong><small>{detail}</small></span><button aria-label={`Toggle ${title}`} aria-pressed={preferences.alerts[key]} className={preferences.alerts[key] ? "toggle on" : "toggle"} disabled={preferencesSaving} onClick={() => toggleAlert(key)}><i /></button></div>)}</section></div>
        </div>
      </> : activeNav === "Schedule" ? <>
        <div className="page-heading schedule-heading"><p className="overline">YOUR UPCOMING GAMES</p><h1>Schedule</h1><p className="subhead">Plan around the games you care about, from now through the end of the playoffs.</p></div>
        <div className="schedule-layout"><section className="calendar-panel"><div className="schedule-panel-header"><div><p className="overline">CALENDAR</p><h2>{formatMonth(selectedMonth)}</h2></div><div className="month-controls"><button onClick={() => moveMonth(-1)} disabled={selectedMonthIndex === 0} aria-label="Previous month">←</button><button onClick={() => moveMonth(1)} disabled={selectedMonthIndex === calendarMonths.length - 1} aria-label="Next month">→</button></div></div><div className="calendar-filter-row"><label htmlFor="schedule-team">Show games for</label><select id="schedule-team" value={scheduleTeam} onChange={(event) => setScheduleTeam(event.target.value)}>{teamOptions.map((team) => <option key={team}>{team}</option>)}</select><span className="calendar-range">{formatMonth(calendarMonths[0])} — {formatMonth(calendarMonths[calendarMonths.length - 1])}</span></div><div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarCells.map((day, index) => { const dateKey = day ? toDateKey(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day)) : `blank-${index}`; const dayGames = day ? gamesForDate(dateKey) : []; const isSelected = dateKey === selectedDate; const isToday = dateKey === toDateKey(today); return <button className={day ? `calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}` : "calendar-day blank"} key={dateKey} disabled={!day} onClick={() => { if (day) { setSelectedDate(dateKey); setScheduleView("day"); } }}>{day && <><span className="calendar-day-number">{day}</span>{dayGames.length > 0 && <span className="calendar-game-dot" title={`${dayGames.length} game${dayGames.length === 1 ? "" : "s"}`}><i />{dayGames.length}</span>}{dayGames.slice(0, 2).map((game) => <span className="calendar-game-label" key={game.id}>{game.homeShort} <b>·</b> {game.awayShort}</span>)}</>}</button>; })}</div><div className="selected-date-summary"><div><p className="overline">SELECTED DAY</p><h3>{formatShortDate(selectedDay)}</h3></div><span>{gamesForDate(selectedDate).length} game{gamesForDate(selectedDate).length === 1 ? "" : "s"}</span></div>{gamesForDate(selectedDate).length > 0 ? <div className="selected-day-games">{gamesForDate(selectedDate).map((game) => <GameRow game={game} key={game.id} />)}</div> : <div className="empty-schedule compact-empty"><span>◌</span><strong>No games available</strong><small>Try another day or team filter.</small></div>}</section><aside className="soonest-panel"><div className="section-heading compact"><div><p className="overline">QUICK VIEW</p><h2>Soonest games</h2></div><span className="schedule-count">{filteredSchedule.length} total</span></div><div className="schedule-view-tabs" role="tablist" aria-label="Soonest games range">{(["day", "week", "month"] as ScheduleView[]).map((view) => <button className={scheduleView === view ? "active" : ""} key={view} onClick={() => setScheduleView(view)}>{view}</button>)}</div><p className="soonest-description">Showing games for {scheduleView === "day" ? formatShortDate(selectedDay) : scheduleView === "week" ? `the week of ${formatShortDate(range.start)}` : formatMonth(selectedMonth)}.</p>{soonestGames.length > 0 ? <div className="soonest-list">{soonestGames.map((game) => <GameRow game={game} key={game.id} />)}</div> : <div className="empty-schedule"><span>◌</span><strong>No games available</strong><small>There are no upcoming games in this category.</small></div>}<button className="schedule-reset" onClick={() => { setScheduleTeam("All teams"); setScheduleView("month"); setSelectedMonthIndex(0); setSelectedDate(toDateKey(calendarMonths[0])); }}>Reset schedule view <span>↺</span></button></aside></div>
      </> : <>
        <div className="page-heading"><p className="overline">PERSONALIZE YOUR EXPERIENCE</p><h1>{activeNav}</h1><p className="subhead">Choose what you want Courtside to keep an eye on. Changes automatically update your feed and schedule.</p>{preferenceStatus && <p className={preferenceStatus.startsWith("Save failed") || preferenceStatus.startsWith("Could not") ? "preference-status error" : "preference-status"}>{preferenceStatus}</p>}</div><section className="preferences-panel"><div className="preference-block"><div className="section-heading"><div><h2>Favorite teams</h2><p className="panel-copy">Your feed will prioritize games, news, and updates from these teams.</p></div><span className="count-badge">{followedTeams.length} selected</span></div><div className="preference-list">{teams.map((team) => { const selected = preferences.followedTeamIds.includes(team.id); return <button className={selected ? "preference-row selected" : "preference-row"} key={team.id} disabled={preferencesSaving} onClick={() => toggleTeam(team.id)}><TeamMark short={team.short} color={team.color} /><span><strong>{team.name}</strong><small>{team.record} record</small></span><span className="checkmark">{selected ? "✓" : "+"}</span></button>; })}</div></div><div className="preference-block"><div className="section-heading"><div><h2>Favorite players</h2><p className="panel-copy">Get the moments and performances you care about most.</p></div><span className="count-badge">{followedPlayers.length} selected</span></div><div className="preference-list">{players.map((player) => { const selected = preferences.followedPlayerIds.includes(player.id); return <button className={selected ? "preference-row selected" : "preference-row"} key={player.id} disabled={preferencesSaving} onClick={() => togglePlayer(player.id)}><span className="avatar preference-avatar" style={{ background: player.color }}>{player.initials}</span><span><strong>{player.name}</strong><small>{player.teamName} · {player.position}</small></span><span className="checkmark">{selected ? "✓" : "+"}</span></button>; })}</div></div></section>
      </>}
    </section>

    {catchUpOpen && <div className="modal-backdrop" onClick={() => setCatchUpOpen(false)}><section className="catch-up-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCatchUpOpen(false)}>×</button><p className="overline">YOUR 3-MINUTE CATCH-UP</p><h2>Warriors catch-up</h2><p className="modal-lede">Golden State won 118–112. Curry scored 34, Kuminga left with an ankle injury, and the team moved into sixth place.</p><div className="recap-stat-row"><div><strong>118–112</strong><span>Final score</span></div><div><strong>34</strong><span>Curry points</span></div><div><strong>14–2</strong><span>Closing run</span></div></div><h3>Three moments that decided the game</h3><ol className="moment-list"><li><span>01</span><p><strong>Curry bends the defense.</strong> Two late pick-and-rolls opened the corner for Golden State&apos;s biggest run.</p></li><li><span>02</span><p><strong>Kuminga&apos;s third-quarter burst.</strong> His 8 points in four minutes created the cushion before his injury.</p></li><li><span>03</span><p><strong>Draymond closes the door.</strong> A deflection and a transition assist stopped Sacramento&apos;s last push.</p></li></ol><button className="modal-action" onClick={() => setCatchUpOpen(false)}>Back to my feed <span>→</span></button></section></div>}
  </main>;
}

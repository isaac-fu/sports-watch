import type { FeedItem, Game, NewsArticle, Player, PlayerStat, Team, TeamStat } from "./models";

export const mockTeams: Team[] = [
  { id: "gsw", name: "Golden State Warriors", short: "GSW", color: "#f3b942", record: "31–27" },
  { id: "nyk", name: "New York Knicks", short: "NYK", color: "#3e7bd6", record: "38–21" },
  { id: "okc", name: "Oklahoma City Thunder", short: "OKC", color: "#ee7654", record: "43–16" },
  { id: "lal", name: "Los Angeles Lakers", short: "LAL", color: "#8f71c4", record: "35–24" },
  { id: "bos", name: "Boston Celtics", short: "BOS", color: "#73b879", record: "45–14" },
  { id: "phx", name: "Phoenix Suns", short: "PHX", color: "#e87554", record: "32–27" },
  { id: "den", name: "Denver Nuggets", short: "DEN", color: "#4c79c7", record: "39–20" },
  { id: "dal", name: "Dallas Mavericks", short: "DAL", color: "#6a9bc8", record: "34–25" },
  { id: "mia", name: "Miami Heat", short: "MIA", color: "#ed8068", record: "30–29" },
];

export const mockPlayers: Player[] = [
  { id: "stephen-curry", name: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", position: "Guard", initials: "SC", color: "#d99831" },
  { id: "jalen-brunson", name: "Jalen Brunson", teamId: "nyk", teamName: "New York Knicks", position: "Guard", initials: "JB", color: "#4a82d6" },
  { id: "shai-gilgeous-alexander", name: "Shai Gilgeous-Alexander", teamId: "okc", teamName: "Oklahoma City Thunder", position: "Guard", initials: "SG", color: "#e87554" },
];

const teamById = new Map(mockTeams.map((team) => [team.id, team]));
const startOfToday = () => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), date.getDate()); };
const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };

export function getGames(filters: { teamId?: string; from?: string; to?: string } = {}): Game[] {
  const today = startOfToday();
  const matchups: [string, string, string, string, string][] = [
    ["gsw", "lal", "7:30 PM", "ESPN", "Chase Center"],
    ["nyk", "bos", "4:00 PM", "ABC", "Madison Square Garden"],
    ["gsw", "phx", "7:00 PM", "NBA TV", "Chase Center"],
    ["okc", "gsw", "5:30 PM", "ESPN", "Paycom Center"],
    ["lal", "gsw", "6:30 PM", "TNT", "Crypto.com Arena"],
    ["gsw", "nyk", "4:30 PM", "ABC", "Chase Center"],
    ["okc", "nyk", "6:00 PM", "NBA TV", "Paycom Center"],
    ["gsw", "den", "7:00 PM", "ESPN", "Chase Center"],
    ["nyk", "mia", "4:00 PM", "TNT", "Madison Square Garden"],
    ["gsw", "dal", "6:30 PM", "ESPN", "Chase Center"],
  ];
  const offsets = [1, 3, 5, 9, 16, 23, 31, 38, 45, 53];
  return offsets.map((offset, index) => {
    const [homeId, awayId, time, network, venue] = matchups[index];
    return { id: `game-${index + 1}`, date: toDateKey(addDays(today, offset)), time, network, venue, status: "scheduled" as const, home: teamById.get(homeId)!, away: teamById.get(awayId)! };
  }).filter((game) => {
    const teamMatch = !filters.teamId || game.home.id === filters.teamId || game.away.id === filters.teamId;
    const fromMatch = !filters.from || game.date >= filters.from;
    const toMatch = !filters.to || game.date <= filters.to;
    return teamMatch && fromMatch && toMatch;
  });
}

export const mockPlayerStats: PlayerStat[] = [
  { playerId: "stephen-curry", playerName: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", gamesPlayed: 53, pointsPerGame: 27.8, reboundsPerGame: 4.5, assistsPerGame: 6.2, fieldGoalPercentage: 45.8, threePointPercentage: 40.7 },
  { playerId: "jalen-brunson", playerName: "Jalen Brunson", teamId: "nyk", teamName: "New York Knicks", gamesPlayed: 55, pointsPerGame: 28.4, reboundsPerGame: 3.1, assistsPerGame: 7.5, fieldGoalPercentage: 48.1, threePointPercentage: 38.9 },
  { playerId: "shai-gilgeous-alexander", playerName: "Shai Gilgeous-Alexander", teamId: "okc", teamName: "Oklahoma City Thunder", gamesPlayed: 56, pointsPerGame: 32.1, reboundsPerGame: 5.7, assistsPerGame: 6.4, fieldGoalPercentage: 51.9, threePointPercentage: 36.8 },
];

export const mockTeamStats: TeamStat[] = mockTeams.slice(0, 3).map((team, index) => ({ teamId: team.id, teamName: team.name, wins: [31, 38, 43][index], losses: [27, 21, 16][index], conferenceRank: [6, 3, 1][index], pointsPerGame: [114.8, 117.2, 119.1][index], pointsAllowedPerGame: [113.9, 111.2, 108.7][index] }));

export const mockNews: NewsArticle[] = [
  { id: "story-warriors-fourth", title: "The Warriors found their fourth-quarter answer", summary: "A 14–2 run flipped the game, with Curry drawing two defenders and Kuminga attacking the open lane.", source: "Courtside Desk", publishedAt: new Date().toISOString(), url: "#", teamIds: ["gsw"], playerIds: ["stephen-curry"], tags: ["game recap", "warriors"] },
  { id: "story-curry-performance", title: "Curry finishes with 34 points and 8 assists", summary: "He scored 12 in the final period and hit three of his five threes after halftime.", source: "Courtside Stats", publishedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(), url: "#", teamIds: ["gsw"], playerIds: ["stephen-curry"], tags: ["performance", "stephen curry"] },
  { id: "story-kuminga-injury", title: "Kuminga leaves with a left ankle sprain", summary: "The forward will be evaluated tomorrow after playing 27 minutes before exiting in the third quarter.", source: "Courtside Desk", publishedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), url: "#", teamIds: ["gsw"], playerIds: [], tags: ["injury", "warriors"] },
  { id: "story-knicks-road", title: "New York keeps building its late-season momentum", summary: "Brunson led a balanced Knicks offense into the final month of the regular season.", source: "League Wire", publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), url: "#", teamIds: ["nyk"], playerIds: ["jalen-brunson"], tags: ["knicks", "storyline"] },
];

export function getFeed(followedTeamIds: string[], followedPlayerIds: string[]): FeedItem[] {
  const feed: FeedItem[] = [];
  for (const article of mockNews) {
    const matchedPlayers = mockPlayers.filter((player) => article.playerIds.includes(player.id) && followedPlayerIds.includes(player.id));
    const matchedTeams = mockTeams.filter((team) => article.teamIds.includes(team.id) && followedTeamIds.includes(team.id));
    if (matchedPlayers.length === 0 && matchedTeams.length === 0) continue;

    const ageInHours = Math.max(0, (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000);
    const freshnessScore = Math.max(0, 20 - Math.floor(ageInHours));
    const relevanceScore = Math.min(100, matchedPlayers.length * 55 + matchedTeams.length * 30 + freshnessScore);
    const isPerformance = article.tags.includes("performance");
    const isInjury = article.tags.includes("injury");
    const reason = matchedPlayers.length > 0
      ? `Because you follow ${matchedPlayers.map((player) => player.name).join(", ")}`
      : `Because you follow ${matchedTeams.map((team) => team.name).join(", ")}`;

    feed.push({
      id: article.id,
      kind: isPerformance ? "performance" : isInjury ? "injury" : "story",
      eyebrow: article.tags.join(" · "),
      title: article.title,
      body: article.summary,
      publishedAt: article.publishedAt,
      accent: isPerformance ? "blue" : isInjury ? "coral" : "gold",
      teamIds: article.teamIds,
      playerIds: article.playerIds,
      reason,
      relevanceScore,
    });
  }
  return feed.sort((left, right) => right.relevanceScore - left.relevanceScore || new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
}

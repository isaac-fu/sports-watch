import type { Game, GameEvent, NewsArticle, Player, PlayerStat, Team, TeamStat } from "./models";

export const mockTeams: Team[] = [
  { id: "gsw", name: "Golden State Warriors", short: "GSW", color: "#f3b942", record: "31–27", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/gs.png", providerIds: { espn: "9" } },
  { id: "nyk", name: "New York Knicks", short: "NYK", color: "#3e7bd6", record: "38–21", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png", providerIds: { espn: "20" } },
  { id: "okc", name: "Oklahoma City Thunder", short: "OKC", color: "#ee7654", record: "43–16", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png", providerIds: { espn: "25" } },
  { id: "lal", name: "Los Angeles Lakers", short: "LAL", color: "#8f71c4", record: "35–24", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png", providerIds: { espn: "13" } },
  { id: "bos", name: "Boston Celtics", short: "BOS", color: "#73b879", record: "45–14", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png", providerIds: { espn: "2" } },
  { id: "phx", name: "Phoenix Suns", short: "PHX", color: "#e87554", record: "32–27", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png", providerIds: { espn: "21" } },
  { id: "den", name: "Denver Nuggets", short: "DEN", color: "#4c79c7", record: "39–20", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/den.png", providerIds: { espn: "7" } },
  { id: "dal", name: "Dallas Mavericks", short: "DAL", color: "#6a9bc8", record: "34–25", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/dal.png", providerIds: { espn: "6" } },
  { id: "mia", name: "Miami Heat", short: "MIA", color: "#ed8068", record: "30–29", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mia.png", providerIds: { espn: "14" } },
  { id: "sac", name: "Sacramento Kings", short: "SAC", color: "#7654a8", record: "29–30", imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/sac.png", providerIds: { espn: "23" } },
];

export const mockPlayers: Player[] = [
  { id: "stephen-curry", name: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", position: "Guard", initials: "SC", color: "#d99831", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3975.png", providerIds: { espn: "3975" } },
  { id: "jonathan-kuminga", name: "Jonathan Kuminga", teamId: "gsw", teamName: "Golden State Warriors", position: "Forward", initials: "JK", color: "#c98c32", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4433247.png", providerIds: { espn: "4433247" } },
  { id: "draymond-green", name: "Draymond Green", teamId: "gsw", teamName: "Golden State Warriors", position: "Forward", initials: "DG", color: "#b88a38", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/6589.png", providerIds: { espn: "6589" } },
  { id: "jalen-brunson", name: "Jalen Brunson", teamId: "nyk", teamName: "New York Knicks", position: "Guard", initials: "JB", color: "#4a82d6", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3934672.png", providerIds: { espn: "3934672" } },
  { id: "shai-gilgeous-alexander", name: "Shai Gilgeous-Alexander", teamId: "okc", teamName: "Oklahoma City Thunder", position: "Guard", initials: "SG", color: "#e87554", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4278073.png", providerIds: { espn: "4278073" } },
  { id: "lebron-james", name: "LeBron James", teamId: "lal", teamName: "Los Angeles Lakers", position: "Forward", initials: "LJ", color: "#8f71c4", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/1966.png", providerIds: { espn: "1966" } },
  { id: "jayson-tatum", name: "Jayson Tatum", teamId: "bos", teamName: "Boston Celtics", position: "Forward", initials: "JT", color: "#73b879", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4065648.png", providerIds: { espn: "4065648" } },
  { id: "kevin-durant", name: "Kevin Durant", teamId: "phx", teamName: "Phoenix Suns", position: "Forward", initials: "KD", color: "#e87554", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3202.png", providerIds: { espn: "3202" } },
  { id: "nikola-jokic", name: "Nikola Jokić", teamId: "den", teamName: "Denver Nuggets", position: "Center", initials: "NJ", color: "#4c79c7", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3112335.png", providerIds: { espn: "3112335" } },
  { id: "luka-doncic", name: "Luka Dončić", teamId: "dal", teamName: "Dallas Mavericks", position: "Guard", initials: "LD", color: "#6a9bc8", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3945274.png", providerIds: { espn: "3945274" } },
  { id: "bam-adebayo", name: "Bam Adebayo", teamId: "mia", teamName: "Miami Heat", position: "Center", initials: "BA", color: "#ed8068", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4066261.png", providerIds: { espn: "4066261" } },
  { id: "domantas-sabonis", name: "Domantas Sabonis", teamId: "sac", teamName: "Sacramento Kings", position: "Center", initials: "DS", color: "#7654a8", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3153174.png", providerIds: { espn: "3153174" } },
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
  const scheduledGames: Game[] = offsets.map((offset, index) => {
    const [homeId, awayId, time, network, venue] = matchups[index];
    return { id: `game-${index + 1}`, date: toDateKey(addDays(today, offset)), time, network, venue, status: "scheduled", home: teamById.get(homeId)!, away: teamById.get(awayId)! };
  });
  const games: Game[] = [
    { id: "game-live-warriors-kings", date: toDateKey(today), time: "Live", network: "NBA TV", venue: "Golden 1 Center", status: "live", homeScore: 101, awayScore: 104, period: 4, clock: "08:42", updatedAt: new Date().toISOString(), home: teamById.get("sac")!, away: teamById.get("gsw")! },
    { id: "game-final-warriors-kings", date: toDateKey(addDays(today, -1)), time: "Final", network: "NBA TV", venue: "Chase Center", status: "final", homeScore: 118, awayScore: 112, period: 4, clock: "00:00", updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), home: teamById.get("gsw")!, away: teamById.get("sac")! },
    ...scheduledGames,
  ];
  return games.filter((game) => {
    const teamMatch = !filters.teamId || game.home.id === filters.teamId || game.away.id === filters.teamId;
    const fromMatch = !filters.from || game.date >= filters.from;
    const toMatch = !filters.to || game.date <= filters.to;
    return teamMatch && fromMatch && toMatch;
  });
}

const periodLabel = (period: number) => period <= 4 ? `Q${period}` : `OT${period - 4}`;

function mockEvent(gameId: string, sequence: number, minutesAgo: number, event: Omit<GameEvent, "id" | "gameId" | "sequence" | "periodLabel" | "occurredAt" | "importanceScore">): GameEvent {
  return {
    ...event,
    id: `${gameId}-event-${sequence}`,
    gameId,
    sequence,
    periodLabel: periodLabel(event.period),
    occurredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    importanceScore: 0,
  };
}

export function getGameEvents(gameId: string): GameEvent[] {
  if (gameId === "game-live-warriors-kings") {
    return [
      mockEvent(gameId, 1, 104, { period: 1, clock: "12:00", type: "period", title: "Opening tip", description: "Domantas Sabonis wins the opening tip for Sacramento.", teamId: "sac", playerIds: ["domantas-sabonis"], homeScore: 0, awayScore: 0, scoringPlay: false }),
      mockEvent(gameId, 2, 92, { period: 1, clock: "07:18", type: "score", title: "Curry from deep", description: "Stephen Curry makes a 27-foot three-pointer in transition.", teamId: "gsw", playerIds: ["stephen-curry"], homeScore: 13, awayScore: 17, scoringPlay: true, scoreValue: 3 }),
      mockEvent(gameId, 3, 71, { period: 2, clock: "08:06", type: "score", title: "Sabonis finishes inside", description: "Domantas Sabonis scores through contact to pull Sacramento within two.", teamId: "sac", playerIds: ["domantas-sabonis"], homeScore: 42, awayScore: 44, scoringPlay: true, scoreValue: 2 }),
      mockEvent(gameId, 4, 49, { period: 2, clock: "00:00", type: "period", title: "Halftime", description: "Golden State takes a 57–55 lead into the break.", playerIds: [], homeScore: 55, awayScore: 57, scoringPlay: false }),
      mockEvent(gameId, 5, 31, { period: 3, clock: "04:27", type: "injury", title: "Kuminga heads to the locker room", description: "Jonathan Kuminga leaves after turning his left ankle and is questionable to return.", teamId: "gsw", playerIds: ["jonathan-kuminga"], homeScore: 76, awayScore: 80, scoringPlay: false }),
      mockEvent(gameId, 6, 14, { period: 4, clock: "10:41", type: "score", title: "Fox puts the Kings ahead", description: "De'Aaron Fox gets downhill for a layup as Sacramento takes the lead.", teamId: "sac", playerIds: [], homeScore: 99, awayScore: 97, scoringPlay: true, scoreValue: 2 }),
      mockEvent(gameId, 7, 10, { period: 4, clock: "10:02", type: "score", title: "Curry answers", description: "Stephen Curry hits a pull-up three to put Golden State back in front.", teamId: "gsw", playerIds: ["stephen-curry"], homeScore: 99, awayScore: 100, scoringPlay: true, scoreValue: 3 }),
      mockEvent(gameId, 8, 7, { period: 4, clock: "09:17", type: "score", title: "Kings stay close", description: "Sacramento scores in the paint to make it a one-point game.", teamId: "sac", playerIds: [], homeScore: 101, awayScore: 102, scoringPlay: true, scoreValue: 2 }),
      mockEvent(gameId, 9, 3, { period: 4, clock: "08:42", type: "milestone", title: "Curry hits his sixth three", description: "Stephen Curry buries his sixth three of the night to restore a three-point lead.", teamId: "gsw", playerIds: ["stephen-curry"], homeScore: 101, awayScore: 104, scoringPlay: true, scoreValue: 3 }),
    ];
  }

  if (gameId === "game-final-warriors-kings") {
    return [
      mockEvent(gameId, 1, 1_580, { period: 1, clock: "12:00", type: "period", title: "Opening tip", description: "Golden State controls the opening possession.", teamId: "gsw", playerIds: [], homeScore: 0, awayScore: 0, scoringPlay: false }),
      mockEvent(gameId, 2, 1_536, { period: 2, clock: "06:14", type: "milestone", title: "Curry reaches 20 points", description: "Stephen Curry gets to 20 before halftime with his fourth three-pointer.", teamId: "gsw", playerIds: ["stephen-curry"], homeScore: 49, awayScore: 45, scoringPlay: true, scoreValue: 3 }),
      mockEvent(gameId, 3, 1_492, { period: 3, clock: "03:51", type: "injury", title: "Kuminga exits", description: "Jonathan Kuminga leaves with a left ankle sprain and does not return.", teamId: "gsw", playerIds: ["jonathan-kuminga"], homeScore: 84, awayScore: 81, scoringPlay: false }),
      mockEvent(gameId, 4, 1_464, { period: 4, clock: "05:02", type: "score", title: "Kings tie the game", description: "Sacramento completes a 9–2 run to level the score at 106.", teamId: "sac", playerIds: [], homeScore: 106, awayScore: 106, scoringPlay: true, scoreValue: 3 }),
      mockEvent(gameId, 5, 1_459, { period: 4, clock: "02:48", type: "score", title: "Curry breaks the tie", description: "Stephen Curry hits a step-back three to put Golden State ahead for good.", teamId: "gsw", playerIds: ["stephen-curry"], homeScore: 111, awayScore: 108, scoringPlay: true, scoreValue: 3 }),
      mockEvent(gameId, 6, 1_454, { period: 4, clock: "00:32", type: "turnover", title: "Green forces the turnover", description: "Draymond Green strips the ball and Golden State secures possession.", teamId: "gsw", playerIds: ["draymond-green"], homeScore: 116, awayScore: 112, scoringPlay: false }),
      mockEvent(gameId, 7, 1_452, { period: 4, clock: "00:00", type: "period", title: "Final", description: "Golden State closes out a 118–112 win over Sacramento.", teamId: "gsw", playerIds: [], homeScore: 118, awayScore: 112, scoringPlay: false }),
    ];
  }

  return [];
}

export const mockPlayerStats: PlayerStat[] = [
  { playerId: "stephen-curry", playerName: "Stephen Curry", teamId: "gsw", teamName: "Golden State Warriors", gamesPlayed: 53, pointsPerGame: 27.8, reboundsPerGame: 4.5, assistsPerGame: 6.2, fieldGoalPercentage: 45.8, threePointPercentage: 40.7 },
  { playerId: "jalen-brunson", playerName: "Jalen Brunson", teamId: "nyk", teamName: "New York Knicks", gamesPlayed: 55, pointsPerGame: 28.4, reboundsPerGame: 3.1, assistsPerGame: 7.5, fieldGoalPercentage: 48.1, threePointPercentage: 38.9 },
  { playerId: "shai-gilgeous-alexander", playerName: "Shai Gilgeous-Alexander", teamId: "okc", teamName: "Oklahoma City Thunder", gamesPlayed: 56, pointsPerGame: 32.1, reboundsPerGame: 5.7, assistsPerGame: 6.4, fieldGoalPercentage: 51.9, threePointPercentage: 36.8 },
];

export const mockTeamStats: TeamStat[] = mockTeams.slice(0, 3).map((team, index) => ({ teamId: team.id, teamName: team.name, wins: [31, 38, 43][index], losses: [27, 21, 16][index], conferenceRank: [6, 3, 1][index], pointsPerGame: [114.8, 117.2, 119.1][index], pointsAllowedPerGame: [113.9, 111.2, 108.7][index] }));

export const mockNews: NewsArticle[] = [
  { id: "story-warriors-fourth", title: "The Warriors found their fourth-quarter answer", summary: "A 14–2 run flipped the game, with Curry drawing two defenders and Kuminga attacking the open lane.", source: "Sports Watch Desk", publishedAt: new Date().toISOString(), url: "#", teamIds: ["gsw"], playerIds: ["stephen-curry"], tags: ["game recap", "warriors"] },
  { id: "story-curry-performance", title: "Curry finishes with 34 points and 8 assists", summary: "He scored 12 in the final period and hit three of his five threes after halftime.", source: "Sports Watch Stats", publishedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(), url: "#", teamIds: ["gsw"], playerIds: ["stephen-curry"], tags: ["performance", "stephen curry"] },
  { id: "story-kuminga-injury", title: "Kuminga leaves with a left ankle sprain", summary: "The forward will be evaluated tomorrow after playing 27 minutes before exiting in the third quarter.", source: "Sports Watch Desk", publishedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), url: "#", teamIds: ["gsw"], playerIds: ["jonathan-kuminga"], tags: ["injury", "warriors"] },
  { id: "story-knicks-road", title: "New York keeps building its late-season momentum", summary: "Brunson led a balanced Knicks offense into the final month of the regular season.", source: "League Wire", publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), url: "#", teamIds: ["nyk"], playerIds: ["jalen-brunson"], tags: ["knicks", "storyline"] },
];

export type Team = {
  id: string;
  name: string;
  short: string;
  color: string;
  record: string;
  imageUrl?: string;
  providerIds?: Record<string, string>;
};

export type Player = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  position: string;
  initials: string;
  color: string;
  imageUrl?: string;
  providerIds?: Record<string, string>;
};

export type Game = {
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
  home: Team;
  away: Team;
};

export type GameEventType = "score" | "turnover" | "foul" | "timeout" | "injury" | "milestone" | "period" | "play";

export type GameEvent = {
  id: string;
  gameId: string;
  sequence: number;
  period: number;
  periodLabel: string;
  clock: string;
  type: GameEventType;
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

export type GameCenter = {
  game: Game;
  events: GameEvent[];
  keyMoments: GameEvent[];
  updatedAt: string;
  source: string;
  playByPlayStatus: "available" | "pending" | "unavailable";
};

export type CatchUpMoment = {
  id: string;
  title: string;
  detail: string;
  reason: string;
  importanceScore: number;
  source: "game-event" | "news";
  context?: string;
};

export type CatchUpBrief = {
  title: string;
  lede: string;
  readTimeMinutes: number;
  generatedAt: string;
  game: Game | null;
  moments: CatchUpMoment[];
  source: "play-by-play" | "news";
};

export type AlertType = "gameStarting" | "closeGame" | "finalScore" | "standoutPerformance" | "injuryUpdate" | "leadChange" | "milestone";

export type AlertCandidate = {
  candidateId: string;
  type: AlertType;
  title: string;
  body: string;
  priority: number;
  occurredAt: string;
  gameId?: string;
  teamIds: string[];
  playerIds: string[];
};

export type DeliveredAlert = AlertCandidate & {
  id: string;
  read: boolean;
  deliveredAt: string;
  readAt: string | null;
};

export type PlayerStat = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
};

export type PlayerBio = {
  height?: string;
  weight?: string;
  jerseyNumber?: string;
  college?: string;
  country?: string;
  draftYear?: number;
  draftRound?: number;
  draftNumber?: number;
};

export type PlayerSeasonStat = PlayerStat & {
  season: number;
  seasonLabel: string;
  stealsPerGame: number;
  blocksPerGame: number;
  turnoversPerGame: number;
};

export type PlayerCareerStat = Omit<PlayerSeasonStat, "season" | "seasonLabel" | "teamId" | "teamName"> & {
  seasonsPlayed: number;
};

export type PlayerGameLog = {
  id: string;
  gameId: string;
  date: string;
  season: number;
  opponentName: string;
  opponentShort: string;
  homeAway: "home" | "away";
  result: "W" | "L";
  score: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoals: string;
  threePointers: string;
  plusMinus: number;
};

export type PlayerProfile = {
  player: Player;
  bio: PlayerBio;
  currentSeason: PlayerSeasonStat | null;
  career: PlayerCareerStat | null;
  seasons: PlayerSeasonStat[];
  lastTenGames: PlayerGameLog[];
  source: string;
  updatedAt: string;
};

export type TeamStat = {
  teamId: string;
  teamName: string;
  season?: number;
  wins: number;
  losses: number;
  conferenceRank: number;
  pointsPerGame: number;
  pointsAllowedPerGame: number;
};

export type TeamProfile = {
  team: Team;
  seasonLabel: string;
  stats: TeamStat;
  roster: Player[];
  recentGames: Game[];
  upcomingGames: Game[];
  articles: NewsArticle[];
  source: string;
  updatedAt: string;
};

export type NewsArticle = {
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

export type SavedArticle = NewsArticle & {
  savedAt: string;
};

export type SyncDomain = "catalog" | "news" | "stats";

export type SyncResult = {
  domain: SyncDomain;
  provider: string;
  status: "success" | "fallback" | "failed";
  itemCount: number;
  syncedAt: string;
  error?: string;
};

export type AlertPreferences = {
  gameStarting: boolean;
  closeGame: boolean;
  finalScore: boolean;
  standoutPerformance: boolean;
  injuryUpdate: boolean;
  leadChange: boolean;
  milestone: boolean;
};

export type Preferences = {
  followedTeamIds: string[];
  followedPlayerIds: string[];
  alerts: AlertPreferences;
};

export type Account = {
  id: string;
  displayName: string;
  email: string;
  timezone: string;
  createdAt: string;
};

export type FeedItem = {
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

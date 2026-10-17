export type Team = {
  id: string;
  name: string;
  short: string;
  color: string;
  record: string;
};

export type Player = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  position: string;
  initials: string;
  color: string;
};

export type Game = {
  id: string;
  date: string;
  time: string;
  network: string;
  venue: string;
  status: "scheduled" | "live" | "final";
  home: Team;
  away: Team;
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

export type TeamStat = {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  conferenceRank: number;
  pointsPerGame: number;
  pointsAllowedPerGame: number;
};

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  teamIds: string[];
  playerIds: string[];
  tags: string[];
};

export type AlertPreferences = {
  gameStarting: boolean;
  closeGame: boolean;
  finalScore: boolean;
  standoutPerformance: boolean;
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

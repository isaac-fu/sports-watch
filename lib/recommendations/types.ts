import type { Game, GameEvent, NewsArticle, Player, SavedArticle, Team } from "@/lib/models";

export type NewsCandidate = {
  article: NewsArticle;
  matchedTeams: Team[];
  matchedPlayers: Player[];
  freshnessHours: number;
  importanceScore: number;
  sourceQualityScore: number;
  savedInterestScore: number;
  sources: Array<"followed-team" | "followed-player" | "saved-interest" | "important-league-update" | "popular-league-update">;
};

export type TeamCandidate = {
  team: Team;
  followedPlayerCount: number;
  upcomingOpponentCount: number;
  articleMentionCount: number;
  nationalGameCount: number;
  savedArticleMentionCount: number;
  coldStart: boolean;
};

export type PlayerCandidate = {
  player: Player;
  playsForFollowedTeam: boolean;
  upcomingOpponent: boolean;
  articleMentionCount: number;
  teamNationalGameCount: number;
  savedArticleMentionCount: number;
  coldStart: boolean;
};

export type GameCandidate = {
  game: Game;
  articleMentionCount: number;
  broadcastScore: number;
  statusScore: number;
};

export type GameEventCandidate = {
  event: GameEvent;
  game: Game;
  followedTeamMatch: boolean;
  followedPlayerMatch: boolean;
};

export type TeamRecommendation = { team: Team; score: number; reason: string };
export type PlayerRecommendation = { player: Player; score: number; reason: string };
export type GameRecommendation = { game: Game; score: number; reason: string };
export type DiscoveryRecommendations = { teams: TeamRecommendation[]; players: PlayerRecommendation[]; games: GameRecommendation[] };

export type RecommendationInputs = {
  teams: Team[];
  players: Player[];
  articles: NewsArticle[];
  games: Game[];
  savedArticles: SavedArticle[];
};

import type { NewsArticle } from "./models";
import { normalizeNewsText } from "./news-classifier";

export const newsTopics = ["betting", "injuries", "trades", "performance", "recaps", "draft", "coaching"] as const;
export type NewsTopic = typeof newsTopics[number];
export type NewsInterest = "interested" | "not-interested";
export type NewsFeedback = Record<string, { interest: NewsInterest; topics: NewsTopic[] }>;

const patterns: Record<NewsTopic, RegExp> = {
  betting: /\b(bets?|betting|bettors?|wagers?|wagering|gambling|sportsbooks?|sports betting|odds|parlays?|money ?lines?|point spreads?|against the spread|over under|player props?|prop bets?|best picks|betting picks|draftkings|fanduel|betmgm)\b/,
  injuries: /\b(injury|injuries|injured|sprains?|strains?|concussion|surgery|rehab|questionable|doubtful|ruled out)\b/,
  trades: /\b(trades?|traded|trading|roster|contracts?|signing|signed|waived|waivers|free agency|free agents?)\b/,
  performance: /\b(performance|points|assists|rebounds|scoring|triple double|double double|career high|records?|milestone)\b/,
  recaps: /\b(recap|recaps|highlights|final score|game review)\b/,
  draft: /\b(draft|drafted|prospects?|rookies?|lottery)\b/,
  coaching: /\b(coach|coaches|coaching|rotation|rotations|lineup|lineups)\b/,
};

export function classifyNewsTopics(article: Pick<NewsArticle, "title" | "summary" | "tags">): NewsTopic[] {
  const text = normalizeNewsText([article.title, article.summary, ...article.tags].join(" "));
  // Betting recaps often mention points and injuries incidentally; learn the editorial topic.
  if (patterns.betting.test(text)) return ["betting"];
  return newsTopics.filter((topic) => patterns[topic].test(text));
}

export function normalizeNewsFeedback(value: unknown): NewsFeedback {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, entry]) =>
    id.length > 0 && id.length <= 512 && entry && typeof entry === "object"
    && (entry.interest === "interested" || entry.interest === "not-interested")
    && Array.isArray(entry.topics),
  ).map(([id, entry]) => [id, {
    interest: entry.interest as NewsInterest,
    topics: newsTopics.filter((topic) => entry.topics.includes(topic)),
  }]));
}

export function applyNewsFeedback(current: unknown, article: NewsArticle, interest: NewsInterest): NewsFeedback {
  return { ...normalizeNewsFeedback(current), [article.id]: { interest, topics: classifyNewsTopics(article) } };
}

export function newsFeedbackSignals(article: NewsArticle, feedback: NewsFeedback) {
  const explicit = Object.hasOwn(feedback, article.id) ? feedback[article.id].interest : undefined;
  const topics = classifyNewsTopics(article);
  const weights = topics.map((topic) => {
    const votes = Object.values(feedback).reduce((sum, entry) =>
      sum + (entry.topics.includes(topic) ? (entry.interest === "interested" ? 1 : -1) : 0), 0);
    return Math.max(-3, Math.min(3, votes)) * (topic === "betting" ? 30 : 18);
  });
  const topicScore = Math.max(-60, Math.min(40, weights.reduce((sum, weight) => sum + weight, 0)));
  return { excluded: explicit === "not-interested", articleScore: explicit === "interested" ? 35 : 0, topicScore };
}

export function newsFeedbackAdjustment(signals: ReturnType<typeof newsFeedbackSignals> | undefined, surface: "feed" | "catchup") {
  if (!signals) return 0;
  return Math.max(-100, Math.min(70, signals.articleScore + signals.topicScore * (surface === "catchup" ? 2 : 1)));
}

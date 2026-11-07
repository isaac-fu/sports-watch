import { createHash } from "node:crypto";
import type { NewsArticle } from "./models";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (text: string) => new Set(normalize(text).split(" ").filter((word) => word.length > 2 && !["the", "and", "for", "with", "from", "his", "has", "nba", "after", "about"].includes(word)));
function eventType(article: NewsArticle) {
  const text = normalize(article.title);
  if (/return|cleared|available|back in/.test(text)) return "return";
  if (/diagnos|surgery|torn|fracture/.test(text)) return "diagnosis";
  if (/ruled out|sidelined|step away|steps away|leave of absence|indefinite|misses|will miss/.test(text)) return "absence";
  if (/trade|traded/.test(text)) return "trade";
  if (/contract|extension|signs/.test(text)) return "contract";
  if (/\b\d+ (points|point)|scores \d+|drops \d+/.test(text)) return "performance";
  return "other";
}
export function sameNewsEvent(a: NewsArticle, b: NewsArticle) {
  const hours = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) / 3_600_000;
  if (!Number.isFinite(hours) || hours > 72 || eventType(a) !== eventType(b)) return false;
  const entities = (item: NewsArticle) => [...item.playerIds, ...item.teamIds].sort().join("|");
  if (!entities(a) || entities(a) !== entities(b)) return false;
  const numbers = (item: NewsArticle) => (normalize(item.title).match(/\b\d+\b/g) ?? []).sort().join(",");
  if (numbers(a) !== numbers(b)) return false;
  // Compare against the representative, never transitively through another member.
  const left = tokens(a.title), right = tokens(b.title);
  const overlap = Array.from(left).filter((word) => right.has(word)).length;
  const similarity = overlap / Math.max(1, new Set([...Array.from(left), ...Array.from(right)]).size);
  const detailA = tokens(a.summary), detailB = tokens(b.summary);
  const detailOverlap = Array.from(detailA).filter((word) => detailB.has(word)).length / Math.max(1, new Set([...Array.from(detailA), ...Array.from(detailB)]).size);
  return similarity >= .65 || (eventType(a) !== "other" && similarity >= .35 && detailOverlap >= .45);
}

export function groupNewsStories(incoming: NewsArticle[], existing: NewsArticle[] = []): NewsArticle[] {
  const known = new Map(existing.map((article) => [article.id, article]));
  const representatives = new Map<string, NewsArticle>();
  for (const article of [...existing].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id))) {
    if (article.storyId && !representatives.has(article.storyId)) representatives.set(article.storyId, article);
  }
  const grouped = new Map<string, NewsArticle>();
  for (const article of [...incoming].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id))) {
    const prior = known.get(article.id);
    const unchanged = prior && prior.title === article.title && prior.summary === article.summary;
    const match = Array.from(representatives).find(([, representative]) => sameNewsEvent(article, representative));
    const storyId = (unchanged ? prior.storyId : undefined) ?? match?.[0] ?? `story-${createHash("sha256").update(`${article.id}:${article.title}:${article.summary}`).digest("hex").slice(0, 24)}`;
    grouped.set(article.id, { ...article, storyId });
    if (!representatives.has(storyId)) representatives.set(storyId, article);
  }
  return incoming.map((article) => grouped.get(article.id)!);
}

/** Keep the strongest eligible coverage; equal-quality repeats retain the earlier article. */
export function selectStoryArticles<T>(items: T[], articleOf: (item: T) => NewsArticle, relevance: (item: T) => number): T[] {
  const groups = new Map<string, T>();
  const quality = (item: T) => {
    const article = articleOf(item);
    let trusted = false;
    try { trusted = /(^|\.)(nba\.com|espn\.com|apnews\.com|reuters\.com)$/.test(new URL(article.url).hostname); } catch { /* Unknown source. */ }
    return relevance(item) + (trusted ? 12 : 0) + Math.min(12, Math.floor(article.summary.length / 80)) + (article.articleText ? 5 : 0);
  };
  for (const item of items) {
    const article = articleOf(item), key = article.storyId ?? article.id;
    const current = groups.get(key);
    if (!current || quality(item) > quality(current) || (quality(item) === quality(current) && article.publishedAt < articleOf(current).publishedAt)) groups.set(key, item);
  }
  return Array.from(groups.values());
}

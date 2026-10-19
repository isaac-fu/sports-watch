import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { canonicalPlayers, canonicalTeams } from "@/lib/catalog";
import type { NewsArticle } from "@/lib/models";
import { classifyAndTagNews } from "@/lib/news-classifier";
import type { NewsProvider } from "./news-provider";

type XmlRecord = Record<string, unknown>;
export type RssFeedSource = { url: string; name?: string; trustedNba?: boolean };

export const defaultNbaRssFeeds: RssFeedSource[] = [
  { url: "https://www.espn.com/espn/rss/nba/news", name: "ESPN NBA", trustedNba: true },
  { url: "https://www.cbssports.com/rss/headlines/nba", name: "CBS Sports NBA", trustedNba: true },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", trimValues: true });
const asArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const asRecord = (value: unknown): XmlRecord | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as XmlRecord : null;

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return textValue(value[0]);
  const record = asRecord(value);
  if (!record) return "";
  return textValue(record["#text"] ?? record["__cdata"] ?? "");
}

function stripHtml(value: string) {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function linkValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  for (const candidate of asArray(value)) {
    const record = asRecord(candidate);
    if (!record) continue;
    const relation = textValue(record["@rel"]);
    const href = textValue(record["@href"] ?? record["#text"]);
    if (href && (!relation || relation === "alternate")) return href;
  }
  return "";
}

function imageValue(entry: XmlRecord): string | undefined {
  const candidates = [entry["media:content"], entry["media:thumbnail"], entry.enclosure, entry.image];
  for (const candidate of candidates.flatMap((value) => asArray(value))) {
    const record = asRecord(candidate);
    const url = record ? textValue(record["@url"] ?? record.url) : textValue(candidate);
    const type = record ? textValue(record["@type"]) : "";
    if (url && (!type || type.startsWith("image/"))) return url;
  }
  return undefined;
}

function validPublishedAt(value: unknown) {
  const date = new Date(textValue(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function absoluteUrl(value: string, baseUrl: string) {
  try { return new URL(value, baseUrl).toString(); } catch { return value; }
}

function sourceHost(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "NBA RSS"; }
}

function feedDocument(xml: string) {
  const document = parser.parse(xml) as XmlRecord;
  const rss = asRecord(document.rss);
  const channel = asRecord(rss?.channel);
  if (channel) return { title: textValue(channel.title), entries: asArray(channel.item).map(asRecord).filter((entry): entry is XmlRecord => entry !== null) };
  const atom = asRecord(document.feed);
  if (atom) return { title: textValue(atom.title), entries: asArray(atom.entry).map(asRecord).filter((entry): entry is XmlRecord => entry !== null) };
  const rdf = asRecord(document["rdf:RDF"]);
  if (rdf) return { title: textValue(asRecord(rdf.channel)?.title), entries: asArray(rdf.item).map(asRecord).filter((entry): entry is XmlRecord => entry !== null) };
  throw new Error("The response is not a supported RSS or Atom document.");
}

function mapEntry(entry: XmlRecord, source: RssFeedSource, feedTitle: string): NewsArticle | null {
  const title = stripHtml(textValue(entry.title));
  const url = absoluteUrl(linkValue(entry.link) || textValue(entry.guid ?? entry.id), source.url);
  const publishedAt = validPublishedAt(entry.pubDate ?? entry.published ?? entry.updated ?? entry["dc:date"] ?? entry.date);
  if (!title || !url || !publishedAt) return null;
  const rawSummary = textValue(entry.description ?? entry.summary ?? entry["content:encoded"] ?? entry.content);
  const summary = stripHtml(rawSummary).slice(0, 600) || "Open the article for the full story.";
  const publisher = source.name || feedTitle || textValue(entry.source) || sourceHost(url);
  const classified = classifyAndTagNews([title, summary, publisher, url], canonicalTeams, canonicalPlayers);
  if (!source.trustedNba && !classified.nbaRelated) return null;
  return {
    id: `rss-${createHash("sha256").update(url).digest("hex").slice(0, 20)}`,
    title,
    summary,
    source: publisher,
    publishedAt,
    url,
    imageUrl: imageValue(entry),
    teamIds: classified.teamIds,
    playerIds: classified.playerIds,
    tags: classified.tags,
  };
}

export function rssFeedSources(value = process.env.NBA_RSS_FEED_URLS) {
  const urls = value?.split(/[,;\r\n]+/).map((url) => url.trim()).filter(Boolean) ?? [];
  return urls.length > 0 ? urls.map((url) => ({ url, trustedNba: true })) : defaultNbaRssFeeds;
}

export class RssNewsProvider implements NewsProvider {
  readonly name = "rss";

  constructor(private readonly sources = rssFeedSources(), private readonly timeoutMs = Number(process.env.RSS_FETCH_TIMEOUT_MS ?? "10000")) {}

  private async loadSource(source: RssFeedSource) {
    const response = await fetch(source.url, {
      cache: "no-store",
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "SportsWatch/0.1 RSS reader" },
      signal: AbortSignal.timeout(Number.isFinite(this.timeoutMs) ? this.timeoutMs : 10_000),
    });
    if (!response.ok) throw new Error(`${source.name ?? source.url} returned ${response.status}.`);
    const feed = feedDocument(await response.text());
    return feed.entries.map((entry) => mapEntry(entry, source, feed.title)).filter((article): article is NewsArticle => article !== null);
  }

  async getLatestArticles() {
    const results = await Promise.allSettled(this.sources.map((source) => this.loadSource(source)));
    const successful = results.filter((result): result is PromiseFulfilledResult<NewsArticle[]> => result.status === "fulfilled");
    if (successful.length === 0) throw new Error("Every configured NBA RSS feed failed.");
    return successful.flatMap((result) => result.value);
  }
}

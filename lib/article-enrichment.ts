import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { ArticleTextStatus, NewsArticle } from "./models";

const defaultAllowedDomains = ["nba.com", "espn.com", "cbssports.com", "sports.yahoo.com", "si.com"];
const retryAfterMs = 6 * 60 * 60 * 1000;

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function articleContentAllowedDomains(value = process.env.ARTICLE_CONTENT_ALLOWED_DOMAINS) {
  const candidates = value?.split(/[,;\r\n]+/).map((domain) => domain.trim().toLowerCase()).filter(Boolean) ?? defaultAllowedDomains;
  return Array.from(new Set(candidates.map((domain) => domain.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "")).filter((domain) => /^(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/i.test(domain))));
}

function allowedUrl(value: string, domains: string[]) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ? url : null;
  } catch { return null; }
}

async function responseTextWithLimit(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Article response exceeded the configured size limit.");
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Article response exceeded the configured size limit.");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(combined);
}

async function fetchArticleHtml(initialUrl: URL, domains: string[]) {
  const timeoutMs = positiveNumber(process.env.ARTICLE_FETCH_TIMEOUT_MS, 8_000);
  const maxBytes = positiveNumber(process.env.ARTICLE_FETCH_MAX_BYTES, 2_000_000);
  let current = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, {
      cache: "no-store",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "SportsWatch/0.1 article summarizer (+publisher links retained)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Publisher redirect did not include a destination.");
      const next = allowedUrl(new URL(location, current).toString(), domains);
      if (!next) throw new Error("Publisher redirected outside the approved domain list.");
      current = next;
      continue;
    }
    if ([401, 402, 403].includes(response.status)) return { status: "paywalled" as const, html: "", finalUrl: current.toString() };
    if (!response.ok) throw new Error(`Publisher returned ${response.status}.`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("Publisher response was not HTML.");
    return { status: "fetched" as const, html: await responseTextWithLimit(response, maxBytes), finalUrl: current.toString() };
  }
  throw new Error("Publisher redirected too many times.");
}

export function extractArticleText(html: string, url: string, maxChars = positiveNumber(process.env.ARTICLE_TEXT_MAX_CHARS, 18_000)) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  document.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,iframe,svg,canvas,[aria-hidden='true'],[class*='advert'],[id*='advert'],[class*='newsletter'],[class*='social-share']").forEach((element) => element.remove());
  const parsed = new Readability(document, { charThreshold: 300 }).parse();
  const text = (parsed?.textContent ?? "").replace(/\r/g, "").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n").trim();
  return text.slice(0, maxChars);
}

function shouldRetry(article: NewsArticle) {
  if (article.articleText) return false;
  if (article.articleTextStatus === "blocked" || article.articleTextStatus === "paywalled") return false;
  if (!article.articleTextFetchedAt) return true;
  const attemptedAt = new Date(article.articleTextFetchedAt).getTime();
  return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= retryAfterMs;
}

async function enrichArticle(article: NewsArticle, domains: string[]): Promise<NewsArticle> {
  if (!shouldRetry(article)) return article;
  const attemptedAt = new Date().toISOString();
  const url = allowedUrl(article.url, domains);
  if (!url) return { ...article, articleTextStatus: "blocked", articleTextFetchedAt: attemptedAt };
  try {
    const result = await fetchArticleHtml(url, domains);
    if (result.status === "paywalled") return { ...article, articleTextStatus: "paywalled", articleTextFetchedAt: attemptedAt };
    const text = extractArticleText(result.html, result.finalUrl);
    const paywallLanguage = /\b(subscribe|subscription|sign in to continue|become a member|already a subscriber)\b/i.test(result.html);
    if (text.length < 400) return { ...article, articleTextStatus: paywallLanguage ? "paywalled" : "failed", articleTextFetchedAt: attemptedAt };
    return {
      ...article,
      articleText: text,
      articleTextFetchedAt: attemptedAt,
      articleTextStatus: "fetched",
      articleTextHash: createHash("sha256").update(text).digest("hex"),
    };
  } catch {
    return { ...article, articleTextStatus: "failed", articleTextFetchedAt: attemptedAt };
  }
}

export async function enrichNewsArticles(articles: NewsArticle[]) {
  const domains = articleContentAllowedDomains();
  const maxArticles = Math.floor(positiveNumber(process.env.ARTICLE_ENRICHMENT_MAX_ARTICLES, 20));
  const concurrency = Math.min(8, Math.floor(positiveNumber(process.env.ARTICLE_ENRICHMENT_CONCURRENCY, 4)));
  const selected = articles.map((article, index) => ({ article, index })).filter(({ article }) => shouldRetry(article)).slice(0, maxArticles);
  const enriched = [...articles];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (cursor < selected.length) {
      const item = selected[cursor];
      cursor += 1;
      enriched[item.index] = await enrichArticle(item.article, domains);
    }
  }));
  return enriched;
}

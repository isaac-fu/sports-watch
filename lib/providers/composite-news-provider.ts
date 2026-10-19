import type { NewsArticle } from "@/lib/models";
import type { NewsProvider } from "./news-provider";

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

const titleKey = (article: NewsArticle) => article.title.toLowerCase().replace(/[^a-z0-9]/g, "");

export class CompositeNewsProvider implements NewsProvider {
  readonly name: string;

  constructor(private readonly providers: NewsProvider[]) {
    if (providers.length === 0) throw new Error("At least one news provider is required.");
    this.name = providers.map((provider) => provider.name).join("-");
  }

  async getLatestArticles() {
    const results = await Promise.allSettled(this.providers.map((provider) => provider.getLatestArticles()));
    const successful = results.filter((result): result is PromiseFulfilledResult<NewsArticle[]> => result.status === "fulfilled");
    if (successful.length === 0) throw new Error("Every configured news provider failed.");

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const merged: NewsArticle[] = [];
    for (const result of successful) {
      for (const article of result.value) {
        const url = canonicalUrl(article.url);
        const title = titleKey(article);
        if (seenUrls.has(url) || seenTitles.has(title)) continue;
        seenUrls.add(url);
        seenTitles.add(title);
        merged.push(article);
      }
    }
    return merged.sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
  }
}

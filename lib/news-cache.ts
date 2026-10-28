import type { NewsArticle } from "./models";

const publishedTime = (article: NewsArticle) => {
  const timestamp = new Date(article.publishedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export function mergeNewsArticles(fresh: NewsArticle[], cached: NewsArticle[], limit = 100) {
  const byId = new Map(cached.map((article) => [article.id, article]));
  fresh.forEach((article) => {
    const previous = byId.get(article.id);
    byId.set(article.id, {
      ...article,
      articleText: article.articleText ?? previous?.articleText,
      articleTextFetchedAt: article.articleTextFetchedAt ?? previous?.articleTextFetchedAt,
      articleTextStatus: article.articleTextStatus === "rss-content" ? "rss-content" : previous?.articleTextStatus ?? article.articleTextStatus,
      articleTextHash: article.articleTextHash ?? previous?.articleTextHash,
    });
  });

  const seenUrls = new Set<string>();
  return Array.from(byId.values())
    .sort((left, right) => publishedTime(right) - publishedTime(left))
    .filter((article) => {
      const url = article.url.trim().toLowerCase();
      if (url && seenUrls.has(url)) return false;
      if (url) seenUrls.add(url);
      return true;
    })
    .slice(0, Math.max(1, limit));
}

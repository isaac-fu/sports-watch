export const publicCache = (maxAgeSeconds: number, staleSeconds: number) => ({
  "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`,
});

export const privateCache = (maxAgeSeconds: number, staleSeconds: number) => ({
  "Cache-Control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`,
});

import { timingSafeEqual } from "node:crypto";

export function isValidWorkerToken(request: Request, configuredToken: string | undefined, developmentFallback: string) {
  const expectedToken = configuredToken ?? (process.env.NODE_ENV === "production" ? null : developmentFallback);
  const providedToken = request.headers.get("x-worker-token");
  if (!expectedToken || !providedToken) return false;

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

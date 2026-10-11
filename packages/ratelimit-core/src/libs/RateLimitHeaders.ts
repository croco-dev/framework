import type { RateLimitResult } from "./types";

export type RateLimitHeaders = {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
};

export function buildRateLimitHeaders(
  result: RateLimitResult,
  retryAfterSeconds?: number,
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAtMs / 1000)),
  };

  if (!result.success) {
    const retryAfter = retryAfterSeconds ?? Math.ceil((result.resetAtMs - Date.now()) / 1000);
    headers["Retry-After"] = String(Math.max(0, retryAfter));
  }

  return headers;
}

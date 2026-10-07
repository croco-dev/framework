import type { IsrMiddleware, IsrMiddlewareOptions } from "./types";

const CACHEABLE_METHODS = new Set(["GET", "HEAD"]);
const PERSONALIZED_HEADERS = ["authorization", "cookie"] as const;

class NonCacheableResponseError extends Error {
  constructor(readonly response: Response) {
    super("Response is not cacheable");
  }
}

export function createIsrMiddleware(options: IsrMiddlewareOptions): IsrMiddleware {
  const { cache, render, ttlMs } = options;

  return async (request: Request) => {
    if (!isCacheableRequest(request)) {
      return render(request);
    }

    const cacheKey = `${request.method}:${request.url}`;
    try {
      const response = await cache.getOrSet(
        cacheKey,
        async () => {
          const rendered = await render(request);

          if (!isCacheableResponse(rendered)) {
            throw new NonCacheableResponseError(rendered);
          }

          return rendered.clone();
        },
        { ttlMs },
      );

      if (response === undefined) {
        throw new Error("CacheStore returned no ISR response");
      }

      return response.clone();
    } catch (error) {
      if (error instanceof NonCacheableResponseError) {
        return error.response.clone();
      }

      throw error;
    }
  };
}

function isCacheableRequest(request: Request): boolean {
  if (!CACHEABLE_METHODS.has(request.method)) {
    return false;
  }

  return PERSONALIZED_HEADERS.every((header) => !request.headers.has(header));
}

function isCacheableResponse(response: Response): boolean {
  if (response.status < 200 || response.status >= 300) {
    return false;
  }

  // Final personalized responses must never enter the shared cache:
  // Set-Cookie, private/no-store directives, or Vary on identity headers
  // mean the bytes are request-specific even when the status is 2xx.
  if (response.headers.has("set-cookie")) {
    return false;
  }

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (cacheControl.includes("private") || cacheControl.includes("no-store")) {
    return false;
  }

  const vary = response.headers.get("vary")?.toLowerCase() ?? "";
  if (vary.includes("cookie") || vary.includes("authorization")) {
    return false;
  }

  return true;
}

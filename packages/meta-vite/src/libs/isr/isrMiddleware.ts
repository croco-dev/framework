import type { IsrMiddleware, IsrMiddlewareOptions } from "./types";

const CACHEABLE_METHODS = new Set(["GET", "HEAD"]);
const BYPASS_HEADERS = ["authorization", "cookie", "range", "if-range"] as const;

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
    let ownNonCacheableResponse: NonCacheableResponseError | undefined;
    try {
      const response = await cache.getOrSet(
        cacheKey,
        async () => {
          const rendered = await render(request);

          if (!isCacheableResponse(rendered)) {
            ownNonCacheableResponse = new NonCacheableResponseError(rendered);
            throw ownNonCacheableResponse;
          }

          return rendered.clone();
        },
        { ttlMs },
      );

      if (response === undefined) {
        throw new Error("CacheStore returned no ISR response");
      }

      // Older writers may have persisted a response this middleware cannot reuse.
      // The store only exposes getOrSet here, so bypass that entry until it expires.
      if (isPartialResponse(response) || hasVary(response) || requiresFreshResponse(response)) {
        return render(request);
      }

      return response.clone();
    } catch (error) {
      if (error instanceof NonCacheableResponseError) {
        // A failed first fill is shared with waiters. Vary and no-cache responses
        // cannot satisfy those other calls, even if a caller reused the Request object.
        if (
          error !== ownNonCacheableResponse &&
          (hasVary(error.response) || requiresFreshResponse(error.response))
        ) {
          return render(request);
        }
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

  return BYPASS_HEADERS.every((header) => !request.headers.has(header));
}

function isCacheableResponse(response: Response): boolean {
  if (response.status < 200 || response.status >= 300 || isPartialResponse(response)) {
    return false;
  }

  // Final personalized responses must never enter the shared cache:
  // Set-Cookie and private/no-store directives mean the bytes are request-specific.
  if (response.headers.has("set-cookie")) {
    return false;
  }

  // This exact-key TTL cache does not implement Vary-aware representation keys.
  const directives = cacheControlNames(response);
  return (
    directives !== undefined &&
    !directives.has("private") &&
    !directives.has("no-store") &&
    !directives.has("no-cache") &&
    !hasVary(response)
  );
}

function requiresFreshResponse(response: Response): boolean {
  const directives = cacheControlNames(response);
  return directives === undefined || directives.has("no-cache");
}

// Read the complete list in order. Malformed arguments must not hide a cache directive.
function cacheControlNames(response: Response): Set<string> | undefined {
  const header = response.headers.get("cache-control") ?? "";
  const names = new Set<string>();
  // RFC 9110 §5.6.4: qdtext or a quoted-pair; neither permits control bytes except HTAB.
  const member =
    /[ \t]*(?:([!#$%&'*+.^_`|~0-9A-Za-z-]+)(?:[ \t]*=[ \t]*(?:[!#$%&'*+.^_`|~0-9A-Za-z-]+|"(?:[\t\x20-\x21\x23-\x5b\x5d-\x7e\x80-\xff]|\\[\t\x20-\x7e\x80-\xff])*"))?[ \t]*)?(?:,|$)/y;
  while (member.lastIndex < header.length) {
    const match = member.exec(header);
    if (!match) return undefined;
    if (match[1]) names.add(match[1].toLowerCase());
  }
  return names;
}

function hasVary(response: Response): boolean {
  return (response.headers.get("vary") ?? "").split(",").some((part) => part.trim().length > 0);
}

function isPartialResponse(response: Response): boolean {
  return response.status === 206 || response.headers.has("content-range");
}

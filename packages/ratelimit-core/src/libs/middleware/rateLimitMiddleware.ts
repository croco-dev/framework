import { RateLimitExceededProblem } from "../problems/RateLimitExceededProblem";
import type { RateLimiter } from "../RateLimiter";
import { type KeyContext, RateLimitKeyBuilder } from "../RateLimitKeyBuilder";
import type { KeySegment, RateLimitPolicy, RateLimitResult } from "../types";

export interface HttpContext {
  readonly req: {
    method: string;
    path: string;
    headers: Record<string, string>;
  };
  set<T>(key: string, value: T): void;
  get<T>(key: string): T | undefined;
}

export type MiddlewareFunction = (
  ctx: HttpContext,
  next: () => Promise<void>,
) => Promise<void> | void;

export type CreateMiddlewareOptions = {
  rateLimiter: RateLimiter;
  policy: RateLimitPolicy;
  keySegments?: KeySegment[];
  failOpen?: boolean;
  addHeaders?: boolean;
};

export type RateLimitHeaders = {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
};

export const RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY = "rateLimitClientIdentity";

export type RateLimitClientIdentityMetadata = {
  value: string;
  source: string;
  trusted: boolean;
  runtime?: string;
  header?: string;
};

export function createRateLimitMiddleware(options: CreateMiddlewareOptions): MiddlewareFunction {
  const {
    rateLimiter,
    policy,
    keySegments = ["ip"],
    failOpen = false,
    addHeaders = true,
  } = options;
  const keyBuilder = new RateLimitKeyBuilder(keySegments);

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    const clientIdentity = resolveClientIdentity(ctx);
    ctx.set(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY, clientIdentity);
    ctx.set("clientIp", clientIdentity.value);
    ctx.set("ip", clientIdentity.value);

    const keyContext = createKeyContextAdapter(ctx, clientIdentity);
    const key = keyBuilder.build(keyContext, policy.name);

    ctx.set("rateLimitKey", key);

    const result = await rateLimiter.checkWithKey(key, policy);

    ctx.set("rateLimitResult", result);
    if (result.refundReceipt) {
      ctx.set("rateLimitRefundReceipt", result.refundReceipt);
    }

    if (addHeaders) {
      ctx.set("rateLimitHeaders", buildHeaders(result));
    }

    if (!result.success && !failOpen) {
      throw new RateLimitExceededProblem(result);
    }

    await next();
  };
}

function resolveClientIdentity(ctx: HttpContext): RateLimitClientIdentityMetadata {
  const metadata = ctx.get<RateLimitClientIdentityMetadata>(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY);
  if (metadata && normalizeClientIdentity(metadata.value)) {
    return metadata;
  }

  const clientIp = normalizeClientIdentity(ctx.get<string>("clientIp"));
  if (clientIp) {
    return {
      value: clientIp,
      source: "context.clientIp",
      trusted: true,
    };
  }

  const ip = normalizeClientIdentity(ctx.get<string>("ip"));
  if (ip) {
    return {
      value: ip,
      source: "context.ip",
      trusted: true,
    };
  }

  return {
    value: "unknown",
    source: "unknown",
    trusted: false,
  };
}

function createKeyContextAdapter(
  ctx: HttpContext,
  clientIdentity: RateLimitClientIdentityMetadata,
): KeyContext {
  return {
    get<T>(key: string): T | undefined {
      const stored = ctx.get<T>(key);
      if (stored !== undefined) return stored;

      switch (key) {
        case "ip":
        case "clientIp":
          return clientIdentity.value as T;
        case "method":
          return ctx.req.method as T;
        case "path":
          return ctx.req.path as T;
        default:
          return undefined;
      }
    },
  };
}

function normalizeClientIdentity(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function buildHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAtMs / 1000)),
  };

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAtMs - Date.now()) / 1000);
    headers["Retry-After"] = String(Math.max(0, retryAfter));
  }

  return headers;
}

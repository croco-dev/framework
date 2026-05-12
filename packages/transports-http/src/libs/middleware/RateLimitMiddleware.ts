import type {
  CreateMiddlewareOptions,
  HttpContext,
  RateLimiter,
  RateLimitHeaders,
  RateLimitPolicy,
} from "@croco/ratelimit-core";
import { createRateLimitMiddleware } from "@croco/ratelimit-core";
import type { MiddlewareFunction } from "../types";

export type RateLimitHttpOptions = CreateMiddlewareOptions & {
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
};

export interface CrocoHttpContextAdapter extends HttpContext {
  readonly req: {
    method: string;
    path: string;
    headers: Record<string, string>;
  };
  set<T>(key: string, value: T): void;
  get<T>(key: string): T | undefined;
}

function createContextAdapter(ctx: CrocoHttpContextAdapter): HttpContext {
  return {
    req: ctx.req,
    set: ctx.set.bind(ctx),
    get: ctx.get.bind(ctx),
  };
}

/**
 * `@croco/ratelimit-core` 미들웨어를 Croco HTTP 컨텍스트에 맞게 연결합니다.
 */
export function rateLimitHttpMiddleware(options: RateLimitHttpOptions): MiddlewareFunction {
  const { skipSuccessfulRequests, skipFailedRequests, ...createOptions } = options;
  const baseMiddleware = createRateLimitMiddleware(createOptions);

  return async (ctx, next): Promise<void> => {
    const adapter = createContextAdapter(ctx as CrocoHttpContextAdapter);
    const wrappedNext = async (): Promise<void> => {
      await next();

      const status = ctx.res.status;
      const isSuccess = status >= 200 && status < 300;

      if (skipSuccessfulRequests && isSuccess) {
        return;
      }

      if (skipFailedRequests && !isSuccess) {
        return;
      }

      const headers = ctx.get<RateLimitHeaders>("rateLimitHeaders");
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          if (value !== undefined) {
            ctx.raw.header(key, value);
          }
        }
      }
    };

    await baseMiddleware(adapter, wrappedNext);
  };
}

export type RateLimitMiddlewareFactoryOptions = {
  rateLimiter: RateLimiter;
  defaultPolicy: RateLimitPolicy;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
};

/**
 * 기본 정책을 캡슐화한 레이트 리밋 미들웨어 팩토리를 생성합니다.
 */
export function createRateLimitMiddlewareFactory(options: RateLimitMiddlewareFactoryOptions) {
  const { rateLimiter, defaultPolicy, skipSuccessfulRequests, skipFailedRequests } = options;

  return (policyOverride?: RateLimitPolicy): MiddlewareFunction => {
    return rateLimitHttpMiddleware({
      rateLimiter,
      policy: policyOverride ?? defaultPolicy,
      skipSuccessfulRequests,
      skipFailedRequests,
    });
  };
}

export type { CreateMiddlewareOptions, HttpContext } from "@croco/ratelimit-core";
export { createRateLimitMiddleware, type RateLimitHeaders } from "@croco/ratelimit-core";

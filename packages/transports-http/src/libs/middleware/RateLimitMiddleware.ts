import {
  Context as FrameworkContext,
  recordRuntimeInspectionEvent,
} from "@croco/framework-context";
import type {
  CreateMiddlewareOptions,
  HttpContext,
  RateLimitClientIdentityMetadata,
  RateLimiter,
  RateLimitHeaders,
  RateLimitPolicy,
  RateLimitResult,
} from "@croco/ratelimit-core";
import {
  createRateLimitMiddleware,
  RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY,
  RateLimitRefundUnsupportedProblem,
} from "@croco/ratelimit-core";
import type { CrocoHttpContext, MiddlewareFunction } from "../types";
import { markSecurityMiddleware } from "./SecurityMiddlewareMarker";

export type RateLimitSkipPredicate = (ctx: CrocoHttpContext) => boolean | Promise<boolean>;

export type TrustedRateLimitProxyHeader = "x-forwarded-for" | "x-real-ip" | "cf-connecting-ip";

export type RateLimitClientIdentityPolicy = (
  ctx: CrocoHttpContext,
) => RateLimitClientIdentityMetadata;

export type RateLimitHttpOptions = CreateMiddlewareOptions & {
  clientIdentity?: RateLimitClientIdentityPolicy;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skip?: RateLimitSkipPredicate;
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

function applyRateLimitHeaders(ctx: CrocoHttpContext): void {
  const headers = ctx.get<RateLimitHeaders>("rateLimitHeaders");
  if (!headers) {
    return;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      ctx.raw.header(key, value);
      ctx.res.headers[key] = value;
    }
  }
}

/**
 * `@croco/ratelimit-core` 미들웨어를 Croco HTTP 컨텍스트에 맞게 연결합니다.
 */
export function rateLimitHttpMiddleware(options: RateLimitHttpOptions): MiddlewareFunction {
  const {
    clientIdentity = createRuntimeAwareRateLimitClientIdentityPolicy(),
    skipSuccessfulRequests,
    skipFailedRequests,
    skip,
    ...createOptions
  } = options;
  const baseMiddleware = createRateLimitMiddleware(createOptions);

  const middleware: MiddlewareFunction = async (ctx, next): Promise<void> => {
    if (skip && (await skip(ctx))) {
      await next();
      return;
    }

    const clientIdentityMetadata = clientIdentity(ctx);
    ctx.set(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY, clientIdentityMetadata);
    ctx.set("clientIp", clientIdentityMetadata.value);
    ctx.set("ip", clientIdentityMetadata.value);
    recordRuntimeInspectionEvent(FrameworkContext.get()?.runtimeInspector, {
      kind: "rate-limit.client-identity",
      outcome: "succeeded",
      details: {
        runtime:
          clientIdentityMetadata.runtime ??
          FrameworkContext.getRuntimeContext()?.platform ??
          "node",
        source: clientIdentityMetadata.source,
        trusted: clientIdentityMetadata.trusted,
        header: clientIdentityMetadata.header,
        value: clientIdentityMetadata.value,
      },
    });

    const adapter = createContextAdapter(ctx as CrocoHttpContextAdapter);
    const wrappedNext = async (): Promise<void> => {
      try {
        await next();
      } catch (error) {
        if (skipFailedRequests) {
          await refundRateLimit(ctx, createOptions.rateLimiter, createOptions.policy);
        }
        throw error;
      }

      const status = ctx.res.status;
      const isSuccess = status >= 200 && status < 300;

      if (skipSuccessfulRequests && isSuccess) {
        await refundRateLimit(ctx, createOptions.rateLimiter, createOptions.policy);
        return;
      }

      if (skipFailedRequests && !isSuccess) {
        await refundRateLimit(ctx, createOptions.rateLimiter, createOptions.policy);
        return;
      }

      applyRateLimitHeaders(ctx);
    };

    try {
      await baseMiddleware(adapter, wrappedNext);
    } catch (error) {
      applyRateLimitHeaders(ctx);
      throw error;
    }
  };

  return markSecurityMiddleware(middleware, "rateLimitHttpMiddleware");
}

async function refundRateLimit(
  ctx: CrocoHttpContext,
  rateLimiter: RateLimiter,
  policy: RateLimitPolicy,
): Promise<void> {
  const result = ctx.get<RateLimitResult>("rateLimitResult");
  if (!result?.success || result.degraded) {
    return;
  }

  const key = ctx.get<string>("rateLimitKey");
  const receipt = result.refundReceipt;
  if (!key || !receipt) {
    throw new RateLimitRefundUnsupportedProblem();
  }

  await rateLimiter.refundWithKey(key, policy, receipt);
}

export type RateLimitMiddlewareFactoryOptions = {
  rateLimiter: RateLimiter;
  defaultPolicy: RateLimitPolicy;
  clientIdentity?: RateLimitClientIdentityPolicy;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skip?: RateLimitSkipPredicate;
};

/**
 * 기본 정책을 캡슐화한 레이트 리밋 미들웨어 팩토리를 생성합니다.
 */
export function createRateLimitMiddlewareFactory(options: RateLimitMiddlewareFactoryOptions) {
  const {
    rateLimiter,
    defaultPolicy,
    clientIdentity,
    skipSuccessfulRequests,
    skipFailedRequests,
    skip,
  } = options;

  return (policyOverride?: RateLimitPolicy): MiddlewareFunction => {
    return rateLimitHttpMiddleware({
      rateLimiter,
      policy: policyOverride ?? defaultPolicy,
      ...(clientIdentity ? { clientIdentity } : {}),
      ...(skipSuccessfulRequests !== undefined ? { skipSuccessfulRequests } : {}),
      ...(skipFailedRequests !== undefined ? { skipFailedRequests } : {}),
      ...(skip ? { skip } : {}),
    });
  };
}

export function createRuntimeAwareRateLimitClientIdentityPolicy(
  options: {
    trustedProxyHeaders?: readonly TrustedRateLimitProxyHeader[];
  } = {},
): RateLimitClientIdentityPolicy {
  const trustedProxyHeaders = options.trustedProxyHeaders ?? [];

  return (ctx) => {
    const runtime = FrameworkContext.getRuntimeContext();
    const runtimeName = runtime?.platform ?? "node";

    if (runtime?.platform === "lambda") {
      const sourceIp = getLambdaSourceIp(runtime.native);
      if (sourceIp) {
        return createClientIdentity(
          sourceIp,
          "runtime.lambda.requestContext.http.sourceIp",
          true,
          runtimeName,
        );
      }
    }

    if (runtime?.platform === "cloudflare-workers") {
      const sourceIp = readHeader(ctx, "cf-connecting-ip");
      if (sourceIp) {
        return createClientIdentity(
          sourceIp,
          "header.cf-connecting-ip",
          true,
          runtimeName,
          "cf-connecting-ip",
        );
      }
    }

    for (const header of trustedProxyHeaders) {
      const sourceIp = readTrustedProxyHeader(ctx, header);
      if (sourceIp) {
        return createClientIdentity(
          sourceIp,
          `trusted-proxy-header.${header}`,
          true,
          runtimeName,
          header,
        );
      }
    }

    const metadata = ctx.get<RateLimitClientIdentityMetadata>(
      RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY,
    );
    if (metadata && normalizeClientIdentity(metadata.value)) {
      return {
        ...metadata,
        runtime: metadata.runtime ?? runtimeName,
      };
    }

    const clientIp = normalizeClientIdentity(ctx.get<string>("clientIp"));
    if (clientIp) {
      return createClientIdentity(clientIp, "context.clientIp", true, runtimeName);
    }

    const ip = normalizeClientIdentity(ctx.get<string>("ip"));
    if (ip) {
      return createClientIdentity(ip, "context.ip", true, runtimeName);
    }

    return createClientIdentity("unknown", "unknown", false, runtimeName);
  };
}

function createClientIdentity(
  value: string,
  source: string,
  trusted: boolean,
  runtime: string,
  header?: TrustedRateLimitProxyHeader,
): RateLimitClientIdentityMetadata {
  return {
    value,
    source,
    trusted,
    runtime,
    ...(header ? { header } : {}),
  };
}

function getLambdaSourceIp(native: Record<string, unknown> | undefined): string | undefined {
  const event = asRecord(native?.["event"]);
  const requestContext = asRecord(event?.["requestContext"]);
  const http = asRecord(requestContext?.["http"]);
  const sourceIp = http?.["sourceIp"];
  return typeof sourceIp === "string" ? normalizeClientIdentity(sourceIp) : undefined;
}

function readTrustedProxyHeader(
  ctx: CrocoHttpContext,
  header: TrustedRateLimitProxyHeader,
): string | undefined {
  const value = readHeader(ctx, header);
  if (!value || header !== "x-forwarded-for") {
    return value;
  }

  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);
}

function readHeader(
  ctx: CrocoHttpContext,
  header: TrustedRateLimitProxyHeader,
): string | undefined {
  return normalizeClientIdentity(ctx.req.headers[header]);
}

function normalizeClientIdentity(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export type { CreateMiddlewareOptions, HttpContext } from "@croco/ratelimit-core";
export { createRateLimitMiddleware, type RateLimitHeaders } from "@croco/ratelimit-core";

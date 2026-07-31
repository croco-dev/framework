import "reflect-metadata";
import { Component } from "@croco/framework-context";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { HttpExceptionFilter } from "@croco/protocols-rest";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  createRuntimeAwareRateLimitClientIdentityPolicy,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import type { Constructor } from "@croco/protocols-rest";
import { UserController } from "./controllers/UserController";
import { readEnv } from "./env";

const OPERATIONAL_RATE_LIMIT_BYPASS_PATHS = new Set(["/ops/health", "/ops/metrics"]);
const controllers = [UserController];

Component()(HttpExceptionFilter);

export type CreateCrocoAppOptions = {
  readonly extraControllers?: readonly Constructor[];
};

function createControllerList(options: CreateCrocoAppOptions = {}): Constructor[] {
  return [...controllers, ...(options.extraControllers ?? [])];
}

export function createCrocoDiGraphRoots(
  options: CreateCrocoAppOptions = {},
): readonly Constructor[] {
  return createControllerList(options);
}

export function createCrocoApp(options: CreateCrocoAppOptions = {}) {
  const env = readEnv();
  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );
  const appControllers = createControllerList(options);

  return createApp({
    controllers: appControllers,
    globalFilters: [HttpExceptionFilter],
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [env.WEB_ORIGIN] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("api", 100, 60_000),
        clientIdentity: createRuntimeAwareRateLimitClientIdentityPolicy(),
        skip: (ctx) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path),
      }),
    ],
  });
}

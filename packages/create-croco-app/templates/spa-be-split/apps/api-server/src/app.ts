import "reflect-metadata";
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
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { UserController } from "./controllers/UserController";
import { readEnv } from "./env";

const OPERATIONAL_RATE_LIMIT_BYPASS_PATHS = new Set(["/ops/health", "/ops/metrics"]);

export function createCrocoApp() {
  const env = readEnv();
  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );

  return createApp({
    controllers: [UserController],
    globalFilters: [HttpExceptionFilter],
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [env.WEB_ORIGIN] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("api", 100, 60_000),
        skip: (ctx) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path),
      }),
    ],
  });
}

import "reflect-metadata";
import { Controller, Get } from "@croco/protocols-rest";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";

@Controller("/api")
class ApiController {
  @Get("/hello")
  hello() {
    return {
      message: "Hello from Croco API",
    };
  }
}

const OPERATIONAL_RATE_LIMIT_BYPASS_PATHS = new Set([
  "/health",
  "/health/live",
  "/health/ready",
  "/ready",
]);

export function createCrocoApp() {
  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );

  return createApp({
    controllers: [ApiController],
    diValidation: "off",
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:3000"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("api", 100, 60_000),
        skip: (ctx) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path),
      }),
    ],
  });
}

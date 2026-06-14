import "reflect-metadata";
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
import { UserController } from "./controllers/UserController";

export function createCrocoApp() {
  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );

  return createApp({
    controllers: [UserController],
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("api", 100, 60_000),
      }),
    ],
  });
}

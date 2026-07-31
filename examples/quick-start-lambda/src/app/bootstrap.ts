import { AUTH_PROVIDER_TOKEN, AuthGuard } from "@croco/auth-core";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import { setMeteringService } from "@croco/metering-core";
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
  createRuntimeAwareRateLimitClientIdentityPolicy,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { createMeteringService } from "../integrations/inMemoryMetering";
import { TestAuthProvider } from "../integrations/TestAuthProvider";
import { HealthController } from "../protocols/HealthController";
import { UserController } from "../protocols/UserController";
import type { ILogger } from "@croco/framework-context";
import type { MiddlewareFunction } from "@croco/transports-http";

type LambdaExampleApp = ReturnType<typeof createApp>;

const RATE_LIMIT_BYPASS_PATHS = new Set(["/api/health"]);

const demoLogger: ILogger = {
  debug: (message, context) => {
    if (context === undefined) {
      console.debug(message);
      return;
    }
    console.debug(message, context);
  },
  info: (message, context) => {
    if (context === undefined) {
      console.info(message);
      return;
    }
    console.info(message, context);
  },
  warn: (message, context) => {
    if (context === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, context);
  },
  error: (message, context) => {
    if (context === undefined) {
      console.error(message);
      return;
    }
    console.error(message, context);
  },
  child: () => demoLogger,
};

export function createLambdaExampleApp(): LambdaExampleApp {
  registerDemoRuntime();

  return createApp({
    controllers: [HealthController, UserController],
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      createApiRateLimitMiddleware(),
    ],
  });
}

function createApiRateLimitMiddleware(): MiddlewareFunction {
  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );

  return rateLimitHttpMiddleware({
    rateLimiter,
    policy: createSlidingWindowPolicy("api", 100, 60_000),
    clientIdentity: createRuntimeAwareRateLimitClientIdentityPolicy(),
    skip: (ctx) => RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path),
  });
}

export function startLocalServer(app: LambdaExampleApp): void {
  const port = parseLocalPort(process.env.PORT);
  if (port === undefined) {
    console.error(`Invalid PORT value "${process.env.PORT}". Use an integer from 1 to 65535.`);
    process.exitCode = 1;
    return;
  }

  void app
    .listen(port)
    .then(() => {
      console.log(`SaaS demo API running at http://localhost:${port}/api`);
    })
    .catch((error: unknown) => {
      console.error("Failed to start local server", error);
      process.exitCode = 1;
    });
}

function registerDemoRuntime(): void {
  setMeteringService(createMeteringService());
  Container.set(LOGGER_TOKEN, demoLogger);
  Container.set(AUTH_PROVIDER_TOKEN, new TestAuthProvider());
  Container.set(AuthGuard, new AuthGuard());
  Container.set(HealthController, new HealthController());
  Container.set(UserController, new UserController());
}

function parseLocalPort(rawPort: string | undefined): number | undefined {
  if (rawPort === undefined || rawPort === "") {
    return 3000;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }

  return port;
}

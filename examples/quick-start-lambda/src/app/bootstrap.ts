import { LOGGER_TOKEN } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
} from "@croco/framework-module";
import { runWithMeteringService } from "@croco/metering-core";
import { createNodeHost } from "@croco/preset-node";
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
  createHttpAppConfig,
  createRuntimeAwareRateLimitClientIdentityPolicy,
  httpTransport,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { generatedDiGraph } from "../../.croco/di.generated";
import { createMeteringService } from "../integrations/inMemoryMetering";
import type { ILogger } from "@croco/framework-context";
import type { ApplicationRuntime } from "@croco/framework-module";
import type { NodeHost } from "@croco/preset-node";
import type { CrocoApp, MiddlewareFunction } from "@croco/transports-http";

export type LambdaExampleRuntime = {
  readonly app: CrocoApp;
  readonly applicationRuntime: ApplicationRuntime;
};

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
  fatal: (message, context) => {
    if (context === undefined) {
      console.error(message);
      return;
    }
    console.error(message, context);
  },
  child: () => demoLogger,
};

export async function createLambdaExampleRuntime(): Promise<LambdaExampleRuntime> {
  const meteringService = createMeteringService();
  const applicationRuntime = createApplicationRuntime(
    defineCrocoApplication({
      name: "quick-start-lambda",
      imports: [
        httpTransport({
          middlewares: [
            {
              id: "metering",
              order: 50,
              middleware: (_context, next) => runWithMeteringService(meteringService, next),
            },
            { id: "security-headers", order: 100, middleware: securityHeadersMiddleware() },
            {
              id: "cors",
              order: 200,
              middleware: corsMiddleware({
                origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
              }),
            },
            { id: "body-limit", order: 300, middleware: bodyLimitMiddleware({ limit: mb(1) }) },
            { id: "rate-limit", order: 400, middleware: createApiRateLimitMiddleware() },
          ],
        }),
        defineCrocoModule({
          name: "quick-start-logger",
          providers: [{ provide: LOGGER_TOKEN, useValue: demoLogger }],
        }),
      ],
    }),
    generatedDiGraph,
  );
  await applicationRuntime.initialize();

  const app = applicationRuntime.run(() => {
    const transport = createApp(createHttpAppConfig(applicationRuntime));
    transport.getHono();
    return transport;
  });

  return { app, applicationRuntime };
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

export function startLocalServer(runtime: LambdaExampleRuntime): NodeHost | undefined {
  const port = parseLocalPort(process.env.PORT);
  if (port === undefined) {
    console.error(`Invalid PORT value "${process.env.PORT}". Use an integer from 1 to 65535.`);
    process.exitCode = 1;
    return undefined;
  }

  const hono = runtime.app.getHono();
  const host = createNodeHost(
    { fetch: runtime.applicationRuntime.bindHostCallback(hono.fetch.bind(hono)) },
    { port },
  );
  void host
    .start()
    .then(() => {
      console.log(`SaaS demo API running at http://localhost:${port}/api`);
    })
    .catch((error: unknown) => {
      console.error("Failed to start local server", error);
      process.exitCode = 1;
    });

  return host;
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

import "reflect-metadata";
import { betterAuth } from "@croco/auth-better-auth";
import { polarBilling } from "@croco/billing-polar";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import { createNodeHost } from "@croco/preset-node";
import { Controller, Get } from "@croco/protocols-rest";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { qstashTasks } from "@croco/tasks-qstash";
import { nodeTelemetry } from "@croco/telemetry-sdk-node";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  createHttpAppConfig,
  httpTransport,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { drizzleTransaction } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { exampleLogger } from "./shared";

@Controller("/golden")
class GoldenPathHealthController {
  @Get("/")
  health() {
    return { status: "ok" };
  }
}

const GOLDEN_PATH_CONTROLLERS = [GoldenPathHealthController] as const;

export function createProductionGoldenPathApplication() {
  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore({ pruneIntervalMs: 0 }),
    new RateLimitKeyBuilder(["ip"]),
  );
  const profile = [
    httpTransport({ diValidation: "warn" }),
    betterAuth({
      db: drizzle.mock(),
      baseURL: "https://example.test",
      secret: "zero-credential-auth-secret-00000000",
    }),
    drizzleTransaction({ db: drizzle.mock() }),
    polarBilling({
      accessToken: "zero-credential-polar-token",
      environment: "sandbox",
      webhookSecret: "zero-credential-polar-webhook",
      logger: exampleLogger,
    }),
    qstashTasks({
      token: "zero-credential-qstash-token",
      destinationUrl: "https://example.test/tasks",
    }),
    nodeTelemetry({
      serviceName: "first-party-golden-path",
      enabled: false,
      trace: { enabled: false },
    }),
  ] as const;
  const applicationModule = defineCrocoModule({
    name: "first-party-golden-path/application",
    imports: profile.flatMap(({ modules }) => modules),
    controllers: GOLDEN_PATH_CONTROLLERS,
    contributions: [
      ...GOLDEN_PATH_CONTROLLERS.map((controller, order) => ({
        kind: MODULE_CONTRIBUTION_KINDS.httpController,
        id: controller.name,
        order,
        value: controller,
      })),
      {
        kind: MODULE_CONTRIBUTION_KINDS.httpMiddleware,
        id: "security-headers",
        order: 100,
        value: securityHeadersMiddleware(),
      },
      {
        kind: MODULE_CONTRIBUTION_KINDS.httpMiddleware,
        id: "cors",
        order: 200,
        value: corsMiddleware({ origins: ["https://example.test"] }),
      },
      {
        kind: MODULE_CONTRIBUTION_KINDS.httpMiddleware,
        id: "body-limit",
        order: 300,
        value: bodyLimitMiddleware({ limit: mb(1) }),
      },
      {
        kind: MODULE_CONTRIBUTION_KINDS.httpMiddleware,
        id: "rate-limit",
        order: 400,
        value: rateLimitHttpMiddleware({
          rateLimiter,
          policy: createSlidingWindowPolicy("golden-path", 100, 60_000),
        }),
      },
    ],
  });

  return defineCrocoApplication({
    name: "first-party-production-golden-path",
    imports: [...profile, applicationModule],
  });
}

export async function createProductionGoldenPathRuntime() {
  const applicationRuntime = createApplicationRuntime(createProductionGoldenPathApplication());
  await applicationRuntime.initialize();
  const app = applicationRuntime.run(() => createApp(createHttpAppConfig(applicationRuntime)));
  const host = createNodeHost(
    { fetch: applicationRuntime.bindHostCallback(app.getHono().fetch.bind(app.getHono())) },
    { hostname: "127.0.0.1", port: 0 },
  );

  return {
    app,
    applicationRuntime,
    host,
    async dispose() {
      await host.close();
      await applicationRuntime.dispose();
    },
  };
}

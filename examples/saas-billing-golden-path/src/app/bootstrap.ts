import { EventBusConfig, EventPublisher } from "@croco/events-core";
import { InMemoryEventBus } from "@croco/events-inmemory";
import { LOGGER_TOKEN } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
} from "@croco/framework-module";
import type { ApplicationRuntime } from "@croco/framework-module";
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
  httpTransport,
  createRuntimeAwareRateLimitClientIdentityPolicy,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { TxManager } from "@croco/tx-core";
import { CheckoutService } from "../domain/CheckoutService";
import { InMemoryOrderRepository } from "../domain/InMemoryOrderRepository";
import { OrderPaidEvent } from "../events/OrderPaidEvent";
import { OrderPaidProjection } from "../events/OrderPaidProjection";
import { InMemoryAuditLog } from "../integrations/InMemoryAuditLog";
import { createInMemoryTxAdapter, type InMemoryTxClient } from "../integrations/InMemoryTxAdapter";
import { ScriptedPaymentGateway } from "../integrations/ScriptedPaymentGateway";
import { BillingController } from "../protocols/BillingController";
import type { ILogger } from "@croco/framework-context";
import type { CrocoApp, MiddlewareFunction } from "@croco/transports-http";

export type GoldenPathRuntime = {
  readonly app: CrocoApp;
  readonly applicationRuntime: ApplicationRuntime;
  readonly dispose: () => Promise<void>;
  readonly auditLog: InMemoryAuditLog;
  readonly eventBusConfig: EventBusConfig;
  readonly flushTelemetry: () => Promise<void>;
  readonly getTelemetryFlushCount: () => number;
  readonly paymentGateway: ScriptedPaymentGateway;
  readonly repository: InMemoryOrderRepository;
  readonly txManager: TxManager<InMemoryTxClient>;
};

const demoLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => demoLogger,
};

export async function createGoldenPathRuntime(): Promise<GoldenPathRuntime> {
  const auditLog = new InMemoryAuditLog();
  const eventBusConfig = new EventBusConfig();
  const paymentGateway = new ScriptedPaymentGateway();
  const repository = new InMemoryOrderRepository();
  const txManager = new TxManager(createInMemoryTxAdapter());
  let telemetryFlushCount = 0;

  eventBusConfig.setEventBus(new InMemoryEventBus());
  const checkoutService = new CheckoutService(
    repository,
    paymentGateway,
    new EventPublisher(eventBusConfig, txManager),
    txManager,
  );
  const applicationRuntime = createApplicationRuntime(
    defineCrocoApplication({
      name: "saas-billing-golden-path",
      imports: [
        httpTransport({
          controllers: [{ id: "billing", controller: BillingController }],
          middlewares: [
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
          name: "billing",
          providers: [
            { provide: LOGGER_TOKEN, useValue: demoLogger },
            {
              provide: BillingController,
              useValue: new BillingController(auditLog, checkoutService),
            },
            { provide: OrderPaidProjection, useValue: new OrderPaidProjection(auditLog) },
          ],
        }),
      ],
    }),
  );
  await applicationRuntime.initialize();

  eventBusConfig.subscribe({
    eventName: OrderPaidEvent.eventName,
    handlerClass: OrderPaidProjection,
  });
  await eventBusConfig.start({
    handlers: [],
    resolver: { resolve: (handler) => applicationRuntime.get(handler) },
  });

  const app = applicationRuntime.run(() => {
    const transport = createApp(createHttpAppConfig(applicationRuntime));
    transport.getHono();
    transport.fetch = applicationRuntime.bindHostCallback(transport.fetch.bind(transport));
    return transport;
  });

  return {
    app,
    applicationRuntime,
    dispose: async () => {
      eventBusConfig.clear();
      await applicationRuntime.dispose();
    },
    auditLog,
    eventBusConfig,
    flushTelemetry: async () => {
      telemetryFlushCount += 1;
    },
    getTelemetryFlushCount: () => telemetryFlushCount,
    paymentGateway,
    repository,
    txManager,
  };
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
  });
}

export function startLocalServer(runtime: GoldenPathRuntime): void {
  const port = parseLocalPort(process.env.PORT);
  if (port === undefined) {
    console.error(`Invalid PORT value "${process.env.PORT}". Use an integer from 1 to 65535.`);
    process.exitCode = 1;
    return;
  }

  void runtime.applicationRuntime
    .run(() => runtime.app.listen(port))
    .then(() => {
      console.log(`SaaS billing golden path running at http://localhost:${port}/api`);
    })
    .catch((error: unknown) => {
      console.error("Failed to start local server", error);
      process.exitCode = 1;
    });
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

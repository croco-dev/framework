import { EventBusConfig } from "@croco/events-core";
import { InMemoryEventBus } from "@croco/events-inmemory";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
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
import { TxManager, TxManagerRegistry } from "@croco/tx-core";
import { CheckoutService } from "../domain/CheckoutService";
import { InMemoryOrderRepository, ORDER_REPOSITORY_TOKEN } from "../domain/InMemoryOrderRepository";
import { OrderPaidEvent } from "../events/OrderPaidEvent";
import { OrderPaidProjection } from "../events/OrderPaidProjection";
import { AUDIT_LOG_TOKEN, InMemoryAuditLog } from "../integrations/InMemoryAuditLog";
import { createInMemoryTxAdapter, type InMemoryTxClient } from "../integrations/InMemoryTxAdapter";
import {
  PAYMENT_GATEWAY_TOKEN,
  ScriptedPaymentGateway,
} from "../integrations/ScriptedPaymentGateway";
import { BillingController } from "../protocols/BillingController";
import type { ILogger } from "@croco/framework-context";
import type { CrocoApp, MiddlewareFunction } from "@croco/transports-http";

export type GoldenPathRuntime = {
  readonly app: CrocoApp;
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
  child: () => demoLogger,
};

export async function createGoldenPathRuntime(): Promise<GoldenPathRuntime> {
  TxManagerRegistry.clear();
  Container.reset();

  const auditLog = new InMemoryAuditLog();
  const eventBusConfig = new EventBusConfig();
  const paymentGateway = new ScriptedPaymentGateway();
  const repository = new InMemoryOrderRepository();
  const txManager = new TxManager(createInMemoryTxAdapter());
  let telemetryFlushCount = 0;

  EventBusConfig.setInstance(eventBusConfig);
  eventBusConfig.setEventBus(new InMemoryEventBus());

  Container.set(LOGGER_TOKEN, demoLogger);
  Container.set(AUDIT_LOG_TOKEN, auditLog);
  Container.set(ORDER_REPOSITORY_TOKEN, repository);
  Container.set(PAYMENT_GATEWAY_TOKEN, paymentGateway);
  TxManagerRegistry.register(txManager);
  Container.set(OrderPaidProjection, new OrderPaidProjection());
  Container.set(CheckoutService, new CheckoutService());
  Container.set(BillingController, new BillingController());

  eventBusConfig.subscribe({
    eventName: OrderPaidEvent.eventName,
    handlerClass: OrderPaidProjection,
  });
  await eventBusConfig.start({ handlers: [] });

  const app = createApp({
    controllers: [BillingController],
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      createApiRateLimitMiddleware(),
    ],
  });

  return {
    app,
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

export function startLocalServer(app: CrocoApp): void {
  const port = parseLocalPort(process.env.PORT);
  if (port === undefined) {
    console.error(`Invalid PORT value "${process.env.PORT}". Use an integer from 1 to 65535.`);
    process.exitCode = 1;
    return;
  }

  void app
    .listen(port)
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

import "reflect-metadata";
import { EntitlementManager } from "@croco/entitlements-core";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type { Constructor, ILogger } from "@croco/framework-context";
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
  type MiddlewareFunction,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";
import { JobsController } from "./controllers/JobsController";
import { OperationsController } from "./controllers/OperationsController";
import { SaasController } from "./controllers/SaasController";
import { defaultSaasRuntime } from "./saasDemo";

const OPERATIONAL_RATE_LIMIT_BYPASS_PATHS = new Set(["/ops/health", "/ops/diagnostics"]);
const controllers = [OperationsController, JobsController, SaasController];
const diGraphRootControllers: readonly Constructor[] = controllers;

export function createCrocoDiGraphRoots(): readonly Constructor[] {
  return [...diGraphRootControllers];
}

export function createCrocoApp() {
  if (!Container.has(LOGGER_TOKEN)) {
    Container.set(LOGGER_TOKEN, new BootstrapLogger());
  }
  Container.set(EntitlementManager, defaultSaasRuntime.entitlementManager);

  const rateLimiter = new RateLimiter(
    new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );

  return createApp({
    controllers,
    diValidation: "warn",
    diagnostics: {
      providers: defaultSaasRuntime.diagnosticsCollector.getProviders(),
    },
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      createApiRateLimitMiddleware(rateLimiter),
    ],
  });
}

class BootstrapLogger implements ILogger {
  constructor(private readonly bindings: Record<string, unknown> = {}) {}

  debug(message: string, context?: Record<string, unknown>): void {
    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.debug(message);
      return;
    }
    console.debug(message, outputContext);
  }

  info(message: string, context?: Record<string, unknown>): void {
    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.info(message);
      return;
    }
    console.info(message, outputContext);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, outputContext);
  }

  error(message: string, context?: Record<string, unknown> | Error): void {
    if (context instanceof Error) {
      if (Object.keys(this.bindings).length === 0) {
        console.error(message, context);
        return;
      }
      console.error(message, this.bindings, context);
      return;
    }

    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.error(message);
      return;
    }
    console.error(message, outputContext);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new BootstrapLogger({ ...this.bindings, ...bindings });
  }

  private withBindings(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    const outputContext = { ...this.bindings, ...context };
    return Object.keys(outputContext).length === 0 ? undefined : outputContext;
  }
}

function createApiRateLimitMiddleware(rateLimiter: RateLimiter): MiddlewareFunction {
  return rateLimitHttpMiddleware({
    rateLimiter,
    policy: createSlidingWindowPolicy("api", 100, 60_000),
    clientIdentity: createRuntimeAwareRateLimitClientIdentityPolicy(),
    skip: (ctx) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path),
  });
}

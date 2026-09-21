import { BILLING_GATEWAY_TOKEN } from "@croco/billing-core";
import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { EntitlementManager } from "@croco/entitlements-core";
import { LOGGER_TOKEN } from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import {
  defineCrocoModule,
  MODULE_CONTRIBUTION_KINDS,
  type ModuleContext,
  type ModuleOptions,
  type ModuleProvider,
} from "@croco/framework-module";
import type { Constructor as RestControllerConstructor } from "@croco/protocols-rest";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createRuntimeAwareRateLimitClientIdentityPolicy,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
  type MiddlewareFunction,
} from "@croco/transports-http";
import { JobsController } from "./controllers/JobsController";
import { OperationsController } from "./controllers/OperationsController";
import { SaasController } from "./controllers/SaasController";
import {
  SAAS_RUNTIME_STATE_TOKEN,
  SaasRuntimeState,
  createSaasDemoRuntime,
  type SaasRuntime,
} from "./saasDemo";

const APPLICATION_MODULE_NAME = "saas-application";
const OPERATIONAL_RATE_LIMIT_BYPASS_PATHS = new Set(["/ops/health", "/ops/diagnostics"]);

export const SAAS_APPLICATION_CONTROLLERS: readonly RestControllerConstructor[] = [
  OperationsController,
  JobsController,
  SaasController,
];

export type SaasApplicationModuleOptions = {
  readonly profileModules: readonly ModuleOptions[];
  readonly logger: ILogger;
  readonly shutdownMiddleware: MiddlewareFunction;
  readonly additionalControllers?: readonly RestControllerConstructor[];
  readonly additionalMiddlewares?: readonly MiddlewareFunction[];
  readonly additionalProviders?: readonly ModuleProvider[];
  readonly hostPlatform?: "node" | "lambda" | "cloudflare-workers";
  readonly onRuntimeReset?: (ctx: ModuleContext, runtime: SaasRuntime) => void;
};

export function createSaasApplicationModule(options: SaasApplicationModuleOptions): ModuleOptions {
  const controllers = [...SAAS_APPLICATION_CONTROLLERS, ...(options.additionalControllers ?? [])];
  const middlewares = createApplicationMiddlewares(options);
  const diagnosticsProvider = new SaasApplicationDiagnosticsProvider();

  return defineCrocoModule({
    name: APPLICATION_MODULE_NAME,
    imports: options.profileModules,
    providers: [
      { provide: LOGGER_TOKEN, useValue: options.logger },
      {
        provide: SAAS_RUNTIME_STATE_TOKEN,
        useFactory: (ctx) => {
          const state = new SaasRuntimeState({
            create: () =>
              createSaasDemoRuntime({
                billingGateway: ctx.get(BILLING_GATEWAY_TOKEN),
              }),
            onReset: (runtime) => {
              ctx.set(EntitlementManager, runtime.entitlementManager);
              options.onRuntimeReset?.(ctx, runtime);
            },
          });
          diagnosticsProvider.bind(state);
          return state;
        },
      },
      {
        provide: EntitlementManager,
        useFactory: (ctx) => ctx.get(SAAS_RUNTIME_STATE_TOKEN).current.entitlementManager,
      },
      ...(options.additionalProviders ?? []),
    ],
    exports: [LOGGER_TOKEN, SAAS_RUNTIME_STATE_TOKEN, EntitlementManager],
    controllers,
    contributions: [
      ...controllers.map((controller, order) => ({
        kind: MODULE_CONTRIBUTION_KINDS.httpController,
        id: controller.name,
        order,
        value: controller,
      })),
      ...middlewares.map((middleware, order) => ({
        kind: MODULE_CONTRIBUTION_KINDS.httpMiddleware,
        id: `saas-application-middleware-${order}`,
        order,
        value: middleware,
      })),
      {
        kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
        id: "@croco/create-croco-app/saas-application",
        order: 200,
        value: diagnosticsProvider,
      },
    ],
  });
}

function createApplicationMiddlewares(options: SaasApplicationModuleOptions): MiddlewareFunction[] {
  const rateLimiter = new RateLimiter(
    options.hostPlatform === "cloudflare-workers"
      ? new SlidingWindowInMemoryStore({ pruneIntervalMs: 0 })
      : new SlidingWindowInMemoryStore(),
    new RateLimitKeyBuilder(["ip"]),
  );

  return [
    options.shutdownMiddleware,
    securityHeadersMiddleware(),
    corsMiddleware({ origins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"] }),
    bodyLimitMiddleware({ limit: mb(1) }),
    rateLimitHttpMiddleware({
      rateLimiter,
      policy: createSlidingWindowPolicy("api", 100, 60_000),
      clientIdentity: createRuntimeAwareRateLimitClientIdentityPolicy(),
      skip: (ctx) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path),
    }),
    ...(options.additionalMiddlewares ?? []),
  ];
}

class SaasApplicationDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "saas-application";
  private state?: SaasRuntimeState;

  bind(state: SaasRuntimeState): void {
    this.state = state;
  }

  async getHealth(): Promise<HealthStatus> {
    if (!this.state) {
      throw new TypeError("SaaS runtime state is not initialized");
    }
    const report = await this.state.current.diagnosticsCollector.getReport();
    return {
      status:
        report.summary === "all_healthy"
          ? "healthy"
          : report.summary === "degraded"
            ? "degraded"
            : "unhealthy",
      component: this.name,
      details: {
        components: report.components,
        recentErrors: report.recentErrors,
      },
      lastChecked: report.timestamp,
    };
  }
}

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Container, type ILogger, LOGGER_TOKEN, type Constructor } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { ProblemFactory } from "@croco/problems-core";
import { Hono } from "hono";
import { getMimeType } from "hono/utils/mime";
import { CrocoLambdaAdapter, type LambdaHandlerOptions } from "./CrocoLambdaAdapter";
import { CrocoRouteRegistrar } from "./CrocoRouteRegistrar";
import {
  DEV_INSPECTOR_ENDPOINT_PATH,
  authorizeDevInspectorRequest,
  resolveDevInspector,
  resolveDevInspectorEndpointPolicy,
} from "./devInspectorEndpoint";
import { ErrorHandler } from "./ErrorHandler";
import { HealthCheckRegistry } from "./HealthCheckRegistry";
import { PipelineRunner } from "./PipelineRunner";
import {
  DIAGNOSTICS_ENDPOINT_PATH,
  METRICS_ENDPOINT_PATH,
  STANDARD_DIAGNOSTICS_ENDPOINT_PATH,
  authorizeDiagnosticsRequest,
  createOperationalMetricsResponse,
  createDefaultDiagnosticsCollector,
  resolveDiagnosticsEndpointPolicy,
  sanitizeDiagnosticsReport,
} from "./operationalEndpoints";

import { type CompileOptions, RouteCompiler } from "./RouteCompiler";
import { type RuntimeContextInit, withRuntimeContextEnv } from "./runtimeContext";
import type {
  AppConfig,
  CompiledRoute,
  LambdaHandler,
  ListenOptions,
  MiddlewareFunction,
} from "./types";

type SecurityValidationMode = NonNullable<AppConfig["securityValidation"]>;
type HonoFetchExecutionContext = Parameters<Hono["fetch"]>[2];
type FetchRuntimeOptions = {
  env?: Record<string, unknown>;
  executionContext?: HonoFetchExecutionContext;
};

type RequiredSecurityMiddleware = {
  readonly exportName: string;
  readonly matches: (middleware: MiddlewareFunction) => boolean;
};

const REQUIRED_SECURITY_MIDDLEWARES: readonly RequiredSecurityMiddleware[] = [
  {
    exportName: "securityHeadersMiddleware",
    matches: (middleware) => middleware.toString().includes("X-Content-Type-Options"),
  },
  {
    exportName: "corsMiddleware",
    matches: (middleware) => middleware.toString().includes("Access-Control-Allow-Origin"),
  },
  {
    exportName: "bodyLimitMiddleware",
    matches: (middleware) => middleware.toString().includes("content-length"),
  },
  {
    exportName: "rateLimitHttpMiddleware",
    matches: (middleware) => middleware.toString().includes("rateLimitHeaders"),
  },
] as const;

/**
 * 컨트롤러를 컴파일해 Hono 앱, Lambda 핸들러, Node 서버로 실행하는 HTTP 애플리케이션입니다.
 */
export class CrocoApp {
  private hono: Hono;
  private routes: CompiledRoute[] = [];
  private booted = false;
  private nodeStaticRoutesRegistered = false;
  private routeRegistrar: CrocoRouteRegistrar;
  private lambdaAdapter: CrocoLambdaAdapter;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: ILogger,
    private readonly errorHandler: ErrorHandler,
    private readonly healthCheckRegistry: HealthCheckRegistry,
  ) {
    this.hono = new Hono();
    this.routeRegistrar = new CrocoRouteRegistrar(
      this.hono,
      this.errorHandler,
      this.config.middlewares ?? [],
      this.logger,
    );
    this.lambdaAdapter = new CrocoLambdaAdapter(this.hono);
  }

  private boot(options: CompileOptions = {}): void {
    if (this.booted) return;

    this.validateSecurityMiddlewareContract();

    this.registerSystemRoutes();

    const compiler = new RouteCompiler(this.logger, new PipelineRunner(this.errorHandler));
    this.routes = compiler.compile(this.config.controllers, {
      ...options,
      container: options.container ?? createRouteCompileContainer(),
      globalGuards: this.config.globalGuards,
      globalInterceptors: this.config.globalInterceptors,
      globalFilters: this.config.globalFilters,
      globalPipes: this.config.globalPipes,
    });

    for (const route of this.routes) {
      this.routeRegistrar.register(route);
    }

    this.booted = true;
  }

  private validateSecurityMiddlewareContract(): void {
    const validationMode = this.getSecurityValidationMode();

    if (validationMode === "off") {
      return;
    }

    const middlewares = this.config.middlewares ?? [];
    const missingMiddlewares = REQUIRED_SECURITY_MIDDLEWARES.filter(
      (requiredMiddleware) =>
        !middlewares.some((middleware) => requiredMiddleware.matches(middleware)),
    );

    if (missingMiddlewares.length === 0) {
      return;
    }

    const middlewareList = missingMiddlewares.map(({ exportName }) => exportName).join(", ");
    const message =
      `Missing required security middleware: ${middlewareList}. ` +
      "Add the required middleware or set securityValidation: 'off' (or unsafeSkipSecurityValidation: true) during migration.";

    if (validationMode === "warn") {
      this.logger.warn(message);
      return;
    }

    throw ProblemFactory.internalServerError(
      "transports-http/security-middleware-validation",
      message,
    );
  }

  private getSecurityValidationMode(): SecurityValidationMode {
    if (this.config.unsafeSkipSecurityValidation) {
      return "off";
    }

    if (this.config.securityValidation) {
      return this.config.securityValidation;
    }

    const envMode = process.env.CROCO_HTTP_SECURITY_VALIDATION;

    if (envMode === "off" || envMode === "warn" || envMode === "enforce") {
      return envMode;
    }

    return "enforce";
  }

  private registerSystemRoutes(): void {
    this.hono.get("/health", (c) => c.json({ status: "ok" }));

    this.hono.get("/health/live", (c) => c.json({ status: "ok" }, 200));

    this.hono.get("/health/ready", async (c) => {
      const result = await this.healthCheckRegistry.check();
      return c.json(result, result.status === "up" ? 200 : 503);
    });

    this.hono.get("/ready", async (c) => {
      const result = await this.healthCheckRegistry.check();
      return c.json(result, result.status === "up" ? 200 : 503);
    });

    const diagnosticsPolicy = resolveDiagnosticsEndpointPolicy(this.config.diagnostics);
    if (diagnosticsPolicy.exposure !== "off") {
      const collector =
        diagnosticsPolicy.collector ??
        createDefaultDiagnosticsCollector(diagnosticsPolicy.providers ?? []);

      const registerDiagnosticsRoute = (path: string): void => {
        this.hono.get(path, async (c) => {
          if (!(await authorizeDiagnosticsRequest(c, diagnosticsPolicy))) {
            return c.json({ error: "Forbidden" }, 403, { "Cache-Control": "no-store" });
          }

          const report = await collector.getReport();
          return c.json(sanitizeDiagnosticsReport(report, diagnosticsPolicy), 200, {
            "Cache-Control": "no-store",
          });
        });
      };

      registerDiagnosticsRoute(STANDARD_DIAGNOSTICS_ENDPOINT_PATH);
      registerDiagnosticsRoute(DIAGNOSTICS_ENDPOINT_PATH);
    }

    const devInspectorPolicy = resolveDevInspectorEndpointPolicy(this.config.devInspector);
    if (devInspectorPolicy.exposure !== "off") {
      const inspector = resolveDevInspector(devInspectorPolicy);
      this.routeRegistrar.setRuntimeInspector(inspector);

      this.hono.get(DEV_INSPECTOR_ENDPOINT_PATH, async (c) => {
        if (!(await authorizeDevInspectorRequest(c, devInspectorPolicy))) {
          return c.json({ error: "Forbidden" }, 403, { "Cache-Control": "no-store" });
        }

        return c.json(inspector.snapshot(), 200, { "Cache-Control": "no-store" });
      });
    }

    this.hono.get(METRICS_ENDPOINT_PATH, (c) =>
      c.json(
        createOperationalMetricsResponse(this.healthCheckRegistry.getRegisteredCheckCount()),
        200,
        { "Cache-Control": "no-store" },
      ),
    );
  }

  lambdaHandler(options: LambdaHandlerOptions = {}): LambdaHandler {
    this.boot();
    return this.lambdaAdapter.createHandler({ ...options, logger: options.logger ?? this.logger });
  }

  getHono(): Hono {
    this.boot();
    return this.hono;
  }

  async listen(
    port: number,
    options?: ListenOptions | (() => void),
    callback?: () => void,
  ): Promise<void> {
    this.boot();

    const listenOptions = typeof options === "function" ? undefined : options;
    const onListen = typeof options === "function" ? options : callback;

    this.registerNodeStaticRoutes(listenOptions);

    const { serve } = await import("@hono/node-server");

    serve(
      {
        fetch: this.hono.fetch,
        port,
      },
      () => {
        this.logger.info(`Server running on http://localhost:${port}`);
        onListen?.();
      },
    );
  }

  async fetch(
    request: Request,
    runtimeContext?: RuntimeContextInit,
    options: FetchRuntimeOptions = {},
  ): Promise<Response> {
    this.boot();

    if (runtimeContext) {
      return this.hono.fetch(
        request,
        withRuntimeContextEnv(options.env, runtimeContext),
        options.executionContext,
      );
    }

    return this.hono.fetch(request);
  }

  private registerNodeStaticRoutes(options?: ListenOptions): void {
    if (this.nodeStaticRoutesRegistered || !options?.staticDir) {
      return;
    }

    const staticDir = resolve(options.staticDir);
    const spaFallback = options.spaFallback ?? false;

    this.hono.get("*", async (c, next) => {
      const requestPath = this.normalizeRequestPath(c.req.path);
      const filePath = this.resolveStaticFilePath(staticDir, requestPath);

      if (filePath) {
        return this.respondWithStaticFile(filePath);
      }

      if (!spaFallback || this.shouldSkipSpaFallback(c.req.path, c.req.header("accept"))) {
        return next();
      }

      const indexPath = this.resolveStaticFilePath(staticDir, "/index.html");

      if (!indexPath) {
        return next();
      }

      return this.respondWithStaticFile(indexPath);
    });

    this.nodeStaticRoutesRegistered = true;
  }

  private normalizeRequestPath(requestPath: string): string {
    if (requestPath === "/") {
      return "/index.html";
    }

    return requestPath;
  }

  private resolveStaticFilePath(staticDir: string, requestPath: string): string | null {
    const normalizedRelativePath = normalize(requestPath).replace(/^([/\\])+/, "");
    const filePath = resolve(join(staticDir, normalizedRelativePath));

    if (!this.isPathInsideDirectory(staticDir, filePath) || !existsSync(filePath)) {
      return null;
    }

    if (!statSync(filePath).isFile()) {
      return null;
    }

    return filePath;
  }

  private isPathInsideDirectory(baseDir: string, targetPath: string): boolean {
    return targetPath === baseDir || targetPath.startsWith(`${baseDir}${sep}`);
  }

  private shouldSkipSpaFallback(requestPath: string, acceptHeader?: string): boolean {
    if (extname(requestPath) !== "") {
      return true;
    }

    if (!acceptHeader) {
      return false;
    }

    const acceptedTypes = acceptHeader
      .split(",")
      .map((value) => value.split(";", 1)[0]?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));

    return !acceptedTypes.some((value) => value === "text/html" || value === "*/*");
  }

  private async respondWithStaticFile(filePath: string): Promise<Response> {
    const file = await readFile(filePath);
    const contentType = getMimeType(filePath) ?? "application/octet-stream";

    return new Response(file, {
      headers: {
        "content-type": contentType,
      },
    });
  }
}

/**
 * 기본 의존성을 해석해 CrocoApp 인스턴스를 생성합니다.
 */
export function createApp(config: AppConfig): CrocoApp {
  const logger = resolveLogger();

  return new CrocoApp(config, logger, resolveErrorHandler(logger), resolveHealthCheckRegistry());
}

function resolveLogger(): ILogger {
  const registeredLogger = Container.getOptional(LOGGER_TOKEN);
  if (registeredLogger) {
    return registeredLogger;
  }

  const logger = Container.has(Logger) ? Container.get(Logger) : new SilentLogger();
  Container.set(LOGGER_TOKEN, logger);
  return logger;
}

function resolveErrorHandler(logger: ILogger): ErrorHandler {
  const registeredErrorHandler = Container.getOptional(ErrorHandler);
  if (registeredErrorHandler) {
    return registeredErrorHandler;
  }

  return Container.set(ErrorHandler, new ErrorHandler(logger));
}

function resolveHealthCheckRegistry(): HealthCheckRegistry {
  return (
    Container.getOptional(HealthCheckRegistry) ??
    Container.set(HealthCheckRegistry, new HealthCheckRegistry())
  );
}

function createRouteCompileContainer(): NonNullable<CompileOptions["container"]> {
  return {
    get<T>(type: Constructor<T>): T {
      return Container.getOptional(type) ?? new type();
    },
  };
}

class SilentLogger implements ILogger {
  debug(): void {}

  info(): void {}

  warn(): void {}

  error(): void {}

  child(): ILogger {
    return this;
  }
}

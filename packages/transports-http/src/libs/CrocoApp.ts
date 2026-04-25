import { Container, type ILogger, LOGGER_TOKEN } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { ProblemFactory } from '@croco/problems-core';
import { Hono } from 'hono';
import { CrocoLambdaAdapter } from './CrocoLambdaAdapter';
import { CrocoRouteRegistrar } from './CrocoRouteRegistrar';
import { ErrorHandler } from './ErrorHandler';
import { HealthCheckRegistry } from './HealthCheckRegistry';
import { PipelineRunner } from './PipelineRunner';

import { type CompileOptions, RouteCompiler } from './RouteCompiler';
import type { AppConfig, CompiledRoute, LambdaHandler, MiddlewareFunction } from './types';

type SecurityValidationMode = NonNullable<AppConfig['securityValidation']>;

type RequiredSecurityMiddleware = {
  readonly exportName: string;
  readonly matches: (middleware: MiddlewareFunction) => boolean;
};

const REQUIRED_SECURITY_MIDDLEWARES: readonly RequiredSecurityMiddleware[] = [
  {
    exportName: 'securityHeadersMiddleware',
    matches: (middleware) => middleware.toString().includes('X-Content-Type-Options'),
  },
  {
    exportName: 'corsMiddleware',
    matches: (middleware) => middleware.toString().includes('Access-Control-Allow-Origin'),
  },
  {
    exportName: 'bodyLimitMiddleware',
    matches: (middleware) => middleware.toString().includes('content-length'),
  },
  {
    exportName: 'rateLimitHttpMiddleware',
    matches: (middleware) => middleware.toString().includes('rateLimitHeaders'),
  },
] as const;

/**
 * 컨트롤러를 컴파일해 Hono 앱, Lambda 핸들러, Node 서버로 실행하는 HTTP 애플리케이션입니다.
 */
export class CrocoApp {
  private hono: Hono;
  private routes: CompiledRoute[] = [];
  private booted = false;
  private routeRegistrar: CrocoRouteRegistrar;
  private lambdaAdapter: CrocoLambdaAdapter;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: ILogger,
    private readonly errorHandler: ErrorHandler,
    private readonly healthCheckRegistry: HealthCheckRegistry
  ) {
    this.hono = new Hono();
    this.routeRegistrar = new CrocoRouteRegistrar(this.hono, this.errorHandler, this.config.middlewares ?? []);
    this.lambdaAdapter = new CrocoLambdaAdapter(this.hono);
  }

  private boot(options: CompileOptions = {}): void {
    if (this.booted) return;

    this.validateSecurityMiddlewareContract();

    this.registerSystemRoutes();

    const compiler = new RouteCompiler(this.logger, new PipelineRunner(this.errorHandler, this.logger));
    this.routes = compiler.compile(this.config.controllers, {
      ...options,
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

    if (validationMode === 'off') {
      return;
    }

    const middlewares = this.config.middlewares ?? [];
    const missingMiddlewares = REQUIRED_SECURITY_MIDDLEWARES.filter(
      (requiredMiddleware) => !middlewares.some((middleware) => requiredMiddleware.matches(middleware))
    );

    if (missingMiddlewares.length === 0) {
      return;
    }

    const middlewareList = missingMiddlewares.map(({ exportName }) => exportName).join(', ');
    const message =
      `Missing required security middleware: ${middlewareList}. ` +
      "Add the required middleware or set securityValidation: 'off' (or unsafeSkipSecurityValidation: true) during migration.";

    if (validationMode === 'warn') {
      this.logger.warn(message);
      return;
    }

    throw ProblemFactory.internalServerError('transports-http/security-middleware-validation', message);
  }

  private getSecurityValidationMode(): SecurityValidationMode {
    if (this.config.unsafeSkipSecurityValidation) {
      return 'off';
    }

    if (this.config.securityValidation) {
      return this.config.securityValidation;
    }

    const envMode = process.env.CROCO_HTTP_SECURITY_VALIDATION;

    if (envMode === 'off' || envMode === 'warn' || envMode === 'enforce') {
      return envMode;
    }

    return 'enforce';
  }

  private registerSystemRoutes(): void {
    this.hono.get('/health', (c) => c.json({ status: 'ok' }));

    this.hono.get('/health/live', (c) => c.json({ status: 'ok' }, 200));

    this.hono.get('/health/ready', async (c) => {
      const result = await this.healthCheckRegistry.check();
      return c.json(result, result.status === 'ok' ? 200 : 503);
    });

    this.hono.get('/ready', async (c) => {
      const result = await this.healthCheckRegistry.check();
      return c.json(result, result.status === 'ok' ? 200 : 503);
    });
  }

  lambdaHandler(): LambdaHandler {
    this.boot();
    return this.lambdaAdapter.createHandler();
  }

  getHono(): Hono {
    this.boot();
    return this.hono;
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    this.boot();

    const { serve } = await import('@hono/node-server');

    serve(
      {
        fetch: this.hono.fetch,
        port,
      },
      () => {
        this.logger.info(`Server running on http://localhost:${port}`);
        callback?.();
      }
    );
  }

  async fetch(request: Request): Promise<Response> {
    this.boot();
    return this.hono.fetch(request);
  }
}

/**
 * 기본 의존성을 해석해 CrocoApp 인스턴스를 생성합니다.
 */
export function createApp(config: AppConfig): CrocoApp {
  return new CrocoApp(config, resolveLogger(), resolveErrorHandler(), resolveHealthCheckRegistry());
}

function resolveLogger(): ILogger {
  if (!Container.has(LOGGER_TOKEN)) {
    Container.set(LOGGER_TOKEN, Container.get(Logger));
  }

  return Container.get(LOGGER_TOKEN);
}

function resolveErrorHandler(): ErrorHandler {
  return Container.get(ErrorHandler);
}

function resolveHealthCheckRegistry(): HealthCheckRegistry {
  return Container.get(HealthCheckRegistry);
}

import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Hono } from 'hono';
import { CrocoLambdaAdapter } from './CrocoLambdaAdapter';
import { CrocoRouteRegistrar } from './CrocoRouteRegistrar';
import { ErrorHandler } from './ErrorHandler';
import { HealthCheckRegistry } from './HealthCheckRegistry';

import { type CompileOptions, RouteCompiler } from './RouteCompiler';
import type { AppConfig, CompiledRoute, LambdaHandler } from './types';

export class CrocoApp {
  private hono: Hono;
  private routes: CompiledRoute[] = [];
  private errorHandler: ErrorHandler;
  private healthCheckRegistry: HealthCheckRegistry;
  private booted = false;
  private logger: Logger;
  private routeRegistrar: CrocoRouteRegistrar;
  private lambdaAdapter: CrocoLambdaAdapter;

  constructor(private config: AppConfig) {
    this.hono = new Hono();
    this.logger = Container.get(Logger);
    this.errorHandler = Container.get(ErrorHandler);
    this.healthCheckRegistry = Container.get(HealthCheckRegistry);
    this.routeRegistrar = new CrocoRouteRegistrar(this.hono, this.errorHandler, this.config.middlewares ?? []);
    this.lambdaAdapter = new CrocoLambdaAdapter(this.hono);
  }

  private boot(options: CompileOptions = {}): void {
    if (this.booted) return;

    this.registerSystemRoutes();

    const compiler = new RouteCompiler();
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

  private registerSystemRoutes(): void {
    this.hono.get('/health', (c) => c.json({ status: 'ok' }));

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

export function createApp(config: AppConfig): CrocoApp {
  return new CrocoApp(config);
}

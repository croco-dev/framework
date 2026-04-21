import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import express, { type Application } from 'express';
import { useContainer, useExpressServer } from 'routing-controllers';
import { BootstrapError, ContainerInitializationError } from './errors';
import type { BootstrapConfig, ServerConfig } from './types';

/**
 * TypeDI-based Node server bootstrap utility
 */
export class Bootstrap {
  private static app: Application | null = null;
  private static config: BootstrapConfig | null = null;
  private static isInitialized = false;
  private static shutdownHandler?: () => Promise<void>;

  private static ensureReflectMetadata() {
    if (!Reflect || !Reflect.defineMetadata) {
      throw new BootstrapError('reflect-metadata is not loaded. Please import it before using Bootstrap.');
    }
  }

  private static async initializeContainer(config: BootstrapConfig) {
    try {
      Container.reset();
      if (config.containerSetup) {
        for (const setup of config.containerSetup) {
          await setup();
        }
      }
    } catch (error) {
      throw new ContainerInitializationError('Failed to initialize TypeDI container', error);
    }
  }

  private static async initializeApp(config: BootstrapConfig): Promise<Application> {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    if (config.configureApp) {
      await config.configureApp(app);
    }

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    if (config.controllers && config.controllers.length > 0) {
      useContainer(Container);
      useExpressServer(app, {
        routePrefix: config.routePrefix ?? '/v1',
        controllers: config.controllers,
        middlewares: config.middlewares ?? [],
        validation: config.validation !== false,
        defaultErrorHandler: false,
      });
    }

    return app;
  }

  static async bootstrap(config: BootstrapConfig): Promise<Application> {
    if (Bootstrap.isInitialized) {
      throw new BootstrapError('Bootstrap has already been initialized');
    }

    try {
      Bootstrap.ensureReflectMetadata();
      Bootstrap.config = config;
      await Bootstrap.initializeContainer(config);
      Bootstrap.app = await Bootstrap.initializeApp(config);
      Bootstrap.app.disable('x-powered-by');

      if (config.onBootstrap) {
        await config.onBootstrap(Bootstrap.app, Container);
      }

      Bootstrap.isInitialized = true;
      return Bootstrap.app;
    } catch (error) {
      throw new BootstrapError('Failed to bootstrap application', error);
    }
  }

  static async start(serverConfig: ServerConfig = {}): Promise<void> {
    if (!Bootstrap.app) {
      throw new BootstrapError('Application not bootstrapped. Call bootstrap() first.');
    }

    const port = serverConfig.port ?? (process.env.PORT || 3000);
    const server = Bootstrap.app.listen(port, () => {
      process.stderr.write(`Server is running on port ${port}\n`);
      process.stderr.write(`Health check: http://localhost:${port}/health\n`);
    });

    if (Bootstrap.shutdownHandler) {
      process.off('SIGTERM', Bootstrap.shutdownHandler);
      process.off('SIGINT', Bootstrap.shutdownHandler);
    }

    const shutdown = async () => {
      process.stderr.write('Shutting down gracefully...\n');
      server.close(() => {
        process.stderr.write('HTTP server closed\n');
      });
      if (Bootstrap.config?.onShutdown) {
        await Bootstrap.config.onShutdown();
      }
    };

    Bootstrap.shutdownHandler = shutdown;
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  static getApp(): Application {
    if (!Bootstrap.app) {
      throw new BootstrapError('Application not bootstrapped');
    }
    return Bootstrap.app;
  }

  static reset() {
    if (Bootstrap.shutdownHandler) {
      process.off('SIGTERM', Bootstrap.shutdownHandler);
      process.off('SIGINT', Bootstrap.shutdownHandler);
      Bootstrap.shutdownHandler = undefined;
    }

    Bootstrap.app = null;
    Bootstrap.config = null;
    Bootstrap.isInitialized = false;
    Container.reset();
  }
}

export async function createServer(config: BootstrapConfig): Promise<Application> {
  const app = await Bootstrap.bootstrap(config);
  return app;
}

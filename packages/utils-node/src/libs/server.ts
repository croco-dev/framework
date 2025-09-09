import 'reflect-metadata';
import express, { Application } from 'express';
import { useContainer, useExpressServer } from 'routing-controllers';
import { Container } from 'typedi';
import { BootstrapError, ContainerInitializationError } from './errors';
import { BootstrapConfig, ServerConfig } from './types';

/**
 * TypeDI-based Node server bootstrap utility
 */
export class Bootstrap {
  private static app: Application | null = null;
  private static config: BootstrapConfig | null = null;
  private static isInitialized = false;

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
        routePrefix: config.routePrefix || '/v1',
        controllers: config.controllers,
        middlewares: config.middlewares || [],
        validation: config.validation !== false,
        defaultErrorHandler: false,
      });
    }

    return app;
  }

  static async bootstrap(config: BootstrapConfig): Promise<Application> {
    if (this.isInitialized) {
      throw new BootstrapError('Bootstrap has already been initialized');
    }

    try {
      this.ensureReflectMetadata();
      this.config = config;
      await this.initializeContainer(config);
      this.app = await this.initializeApp(config);
      this.app.disable('x-powered-by');

      if (config.onBootstrap) {
        await config.onBootstrap(this.app, Container);
      }

      this.isInitialized = true;
      return this.app;
    } catch (error) {
      throw new BootstrapError('Failed to bootstrap application', error);
    }
  }

  static async start(serverConfig: ServerConfig = {}): Promise<void> {
    if (!this.app) {
      throw new BootstrapError('Application not bootstrapped. Call bootstrap() first.');
    }

    const port = serverConfig.port || process.env.PORT || 3000;
    const server = this.app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
    });

    const shutdown = async () => {
      console.log('\n📦 Shutting down gracefully...');
      server.close(() => {
        console.log('✅ HTTP server closed');
      });
      if (this.config?.onShutdown) {
        await this.config.onShutdown();
      }
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  static getApp(): Application {
    if (!this.app) {
      throw new BootstrapError('Application not bootstrapped');
    }
    return this.app;
  }

  static reset() {
    this.app = null;
    this.config = null;
    this.isInitialized = false;
    Container.reset();
  }
}

export async function createServer(config: BootstrapConfig): Promise<Application> {
  const app = await Bootstrap.bootstrap(config);
  return app;
}

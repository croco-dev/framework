import "reflect-metadata";
import type { Constructor } from "@croco/framework-context";
import { createApplicationRuntime } from "@croco/framework-module";
import type { ApplicationRuntime } from "@croco/framework-module";
import { createApp, createGracefulShutdownController } from "@croco/transports-http";
import type { CrocoApp, MiddlewareFunction } from "@croco/transports-http";
import { BootstrapLogger } from "./bootstrapLogger";
import { APPLICATION_CONTROLLERS, createSaasCompositionRoot } from "./compositionRoot";
import {
  assertGeneratedSaasProfileGraph,
  createGeneratedSaasHttpAppConfig,
  type GeneratedSaasProfileMode,
} from "./generatedSaasProviderProfile";
import { ApplicationBootstrapProblem } from "./problems";

export type CreateCrocoAppOptions = {
  readonly additionalMiddlewares?: readonly MiddlewareFunction[];
  readonly profileMode?: GeneratedSaasProfileMode;
  readonly hostPlatform?: "node" | "lambda" | "cloudflare-workers";
};

export type RuntimeOwnedCrocoApp = CrocoApp & {
  readonly applicationRuntime: ApplicationRuntime;
  readonly disposeApplicationRuntime: () => Promise<void>;
};

export function createCrocoDiGraphRoots(): readonly Constructor[] {
  return [...APPLICATION_CONTROLLERS];
}

export function createCrocoDiGraphApplication(): Promise<RuntimeOwnedCrocoApp> {
  return createCrocoApp({ profileMode: "zero-credential" });
}

export async function createCrocoApp(
  options: CreateCrocoAppOptions = {},
): Promise<RuntimeOwnedCrocoApp> {
  const profileMode = options.profileMode ?? "production";
  const logger = new BootstrapLogger();
  let disposeRuntime = (): Promise<void> => Promise.resolve();
  const gracefulShutdown = createGracefulShutdownController({
    logger,
    ...(options.hostPlatform === undefined ? {} : { signals: [] }),
    onShutdown: () => disposeRuntime(),
  });
  const disposeApplicationRuntime = gracefulShutdown.shutdown;

  try {
    const application = createSaasCompositionRoot({
      profileMode,
      logger,
      shutdownMiddleware: gracefulShutdown.middleware,
      ...(options.additionalMiddlewares === undefined
        ? {}
        : { additionalMiddlewares: options.additionalMiddlewares }),
      ...(options.hostPlatform === undefined ? {} : { hostPlatform: options.hostPlatform }),
    });
    const runtime = createApplicationRuntime(application);
    disposeRuntime = () => runtime.dispose();
    await runtime.initialize();
    assertGeneratedSaasProfileGraph(runtime.createGraphManifest(), profileMode);

    return runtime.run(() =>
      bindApplicationRuntime(
        createApp(createGeneratedSaasHttpAppConfig(runtime, profileMode)),
        runtime,
        disposeApplicationRuntime,
      ),
    );
  } catch (error) {
    try {
      await disposeApplicationRuntime();
    } catch (cleanupFailure) {
      throw new ApplicationBootstrapProblem(error, cleanupFailure);
    }
    throw error;
  }
}

function bindApplicationRuntime(
  app: CrocoApp,
  runtime: ApplicationRuntime,
  disposeApplicationRuntime: () => Promise<void>,
): RuntimeOwnedCrocoApp {
  bindHostCallbacks(app, runtime);
  const boundMethods = new Map<PropertyKey, (...args: never[]) => unknown>();

  return new Proxy(app, {
    get(target, property) {
      if (property === "applicationRuntime") {
        return runtime;
      }
      if (property === "disposeApplicationRuntime") {
        return disposeApplicationRuntime;
      }

      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") {
        return value;
      }

      const existing = boundMethods.get(property);
      if (existing) {
        return existing;
      }

      const bound = (...args: never[]) => runtime.run(() => Reflect.apply(value, target, args));
      boundMethods.set(property, bound);
      return bound;
    },
  }) as RuntimeOwnedCrocoApp;
}

function bindHostCallbacks(app: CrocoApp, runtime: ApplicationRuntime): void {
  const createNodeHandler = app.nodeHandler.bind(app);
  app.nodeHandler = () => runtime.bindHostCallback(createNodeHandler());

  const createLambdaHandler = app.lambdaHandler.bind(app);
  app.lambdaHandler = (options) => runtime.bindHostCallback(createLambdaHandler(options));

  const getHono = app.getHono.bind(app);
  let runtimeBoundHono: ReturnType<CrocoApp["getHono"]> | undefined;
  app.getHono = () => {
    if (runtimeBoundHono) {
      return runtimeBoundHono;
    }

    const hono = getHono();
    hono.fetch = runtime.bindHostCallback(hono.fetch.bind(hono));
    runtimeBoundHono = hono;
    return hono;
  };
}

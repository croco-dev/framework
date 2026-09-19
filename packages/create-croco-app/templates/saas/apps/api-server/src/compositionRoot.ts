import type { AuthProvider } from "@croco/auth-core";
import type { ILogger } from "@croco/framework-context";
import type { ModuleOptions } from "@croco/framework-module";
import { InMemoryStorageProvider } from "@croco/storage-core";
import type { TaskDispatcher } from "@croco/tasks-core";
import type { MiddlewareFunction } from "@croco/transports-http";
import { TxManager } from "@croco/tx-core";
import { createSaasApplicationModule, SAAS_APPLICATION_CONTROLLERS } from "./applicationModule";
import {
  createGeneratedSaasApplicationDefinition,
  type GeneratedSaasProfileMode,
} from "./generatedSaasProviderProfile";
import { NoopTxAdapter } from "./inMemoryAdapters";
import { DemoBillingGateway } from "./saasDemo";

export type CreateSaasCompositionRootOptions = {
  readonly profileMode: GeneratedSaasProfileMode;
  readonly logger: ILogger;
  readonly shutdownMiddleware: MiddlewareFunction;
  readonly additionalMiddlewares?: readonly MiddlewareFunction[];
  readonly hostPlatform?: "node" | "lambda" | "cloudflare-workers";
};

export const APPLICATION_CONTROLLERS = SAAS_APPLICATION_CONTROLLERS;

export function createSaasCompositionRoot(options: CreateSaasCompositionRootOptions) {
  const localProviders =
    options.profileMode === "zero-credential"
      ? {
          auth: createLocalAuthProvider(),
          billing: new DemoBillingGateway(),
          storage: new InMemoryStorageProvider(),
          tasks: createLocalTaskDispatcher(),
          transaction: new TxManager(new NoopTxAdapter()),
        }
      : undefined;

  return createGeneratedSaasApplicationDefinition({
    mode: options.profileMode,
    logger: options.logger,
    http: { diValidation: "warn" },
    applicationModules: (profileModules: readonly ModuleOptions[]) => [
      createSaasApplicationModule({
        profileModules,
        logger: options.logger,
        shutdownMiddleware: options.shutdownMiddleware,
        ...(options.additionalMiddlewares === undefined
          ? {}
          : { additionalMiddlewares: options.additionalMiddlewares }),
        ...(options.hostPlatform === undefined ? {} : { hostPlatform: options.hostPlatform }),
      }),
    ],
    ...(localProviders === undefined ? {} : { localProviders }),
  });
}

function createLocalAuthProvider(): AuthProvider {
  return {
    async authenticate() {
      return null;
    },
  };
}

function createLocalTaskDispatcher(): TaskDispatcher {
  return {
    async execute(taskId) {
      return { messageId: `local-${taskId}` };
    },
  };
}

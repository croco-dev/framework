import type { TokenIdentifier } from "@croco/framework-context";
import type { StartedTestResource, TestResource, TestResourceDiagnostic } from "@croco/testing";
import type * as RedisModuleNamespace from "ioredis";
import type { StartedTestContainer } from "testcontainers";
import { loadTestResourceLiveDependency } from "./liveDependencies";
import { TestResourceLifecycleProblem } from "./problems";
import type { TestResourceProvider } from "./providers";
import {
  appendContainerLogs,
  DEFAULT_REDIS_IMAGE,
  errorMessage,
  failedDiagnostic,
  isolationSuffix,
  passedDiagnostic,
  type ResourceImageOptions,
  resolveImage,
  stopContainer,
  throwCleanupFailures,
} from "./shared";

type RedisModule = typeof RedisModuleNamespace;
type RedisClientConstructor = RedisModule extends { readonly default: infer TDefault }
  ? TDefault
  : RedisModule;
type RedisClient = RedisClientConstructor extends abstract new (
  ...arguments_: never[]
) => infer TClient
  ? TClient
  : never;

export type RedisTestConnection = {
  readonly client: RedisClient;
  readonly host: string;
  readonly keyPrefix: string;
  readonly port: number;
  readonly url: string;
};

export type RedisResourceOptions = ResourceImageOptions & {
  readonly id?: string;
  readonly provides?: TokenIdentifier<RedisTestConnection>;
  readonly providers?: readonly TestResourceProvider<RedisTestConnection>[];
  readonly startupTimeoutMs?: number;
};

export function redisResource(
  options: RedisResourceOptions = {},
): TestResource<RedisTestConnection> {
  const id = options.id ?? "redis";
  const image = resolveImage(id, DEFAULT_REDIS_IMAGE, options);
  const fidelity = {
    id,
    image,
    isolation: "prefix-per-test",
    kind: "redis",
    mode: "commit",
  } as const;

  return {
    fidelityHint: fidelity,
    id,
    async start(context): Promise<StartedTestResource<RedisTestConnection>> {
      const { GenericContainer, Wait } = await loadTestResourceLiveDependency(
        id,
        { dependency: "testcontainers", resourceKind: "redis" },
        () => import("testcontainers"),
      );
      const { default: Redis } = await loadTestResourceLiveDependency(
        id,
        { dependency: "ioredis", resourceKind: "redis" },
        () => import("ioredis"),
      );
      const logs: string[] = [];
      const diagnostics: TestResourceDiagnostic[] = [];
      let container: StartedTestContainer | undefined;
      let client: RedisClient | undefined;

      try {
        container = await new GenericContainer(image)
          .withExposedPorts(6379)
          .withLogConsumer(appendContainerLogs(logs))
          .withStartupTimeout(options.startupTimeoutMs ?? 120_000)
          .withWaitStrategy(Wait.forLogMessage(/ready to accept connections/i))
          .start();
        diagnostics.push(passedDiagnostic("startup", "Redis container started", logs));
      } catch (error) {
        diagnostics.push(failedDiagnostic("startup", error, logs));
        throw new TestResourceLifecycleProblem(id, "startup", errorMessage(error), logs, error);
      }

      const host = container.getHost();
      const port = container.getMappedPort(6379);
      const url = `redis://${host}:${port}`;
      const keyPrefix = `croco:${isolationSuffix(context.workerId, context.testId)}:`;

      const connectionResult = await connectRedis(Redis, url, keyPrefix, logs);
      if (!connectionResult.ok) {
        diagnostics.push(failedDiagnostic("health-check", connectionResult.error, logs));
        await cleanupFailedStart(client, container, logs);
        throw new TestResourceLifecycleProblem(
          id,
          "health-check",
          errorMessage(connectionResult.error),
          logs,
          connectionResult.error,
        );
      }
      client = connectionResult.client;
      diagnostics.push(passedDiagnostic("health-check", "Redis responded to PING", logs));

      const activeClient = client;
      const connection: RedisTestConnection = {
        client: activeClient,
        host,
        keyPrefix,
        port,
        url,
      };
      try {
        if (options.provides) {
          context.register(options.provides, connection);
        }
        for (const provider of options.providers ?? []) {
          context.register(provider.token, provider.provide(connection));
        }
      } catch (error) {
        diagnostics.push(failedDiagnostic("startup", error, logs));
        await cleanupFailedStart(activeClient, container, logs);
        throw new TestResourceLifecycleProblem(id, "startup", errorMessage(error), logs, error);
      }

      return {
        connection,
        diagnostics,
        dispose: async () => {
          const failures: unknown[] = [];
          try {
            await activeClient.quit();
          } catch (error) {
            diagnostics.push(failedDiagnostic("cleanup", error, logs));
            failures.push(error);
          }
          try {
            await stopContainer(id, container, logs, diagnostics);
          } catch (error) {
            failures.push(error);
          }
          throwCleanupFailures(id, failures, logs);
        },
        fidelity,
      };
    },
  };
}

type RedisConnectionResult =
  | { readonly client: RedisClient; readonly ok: true }
  | { readonly error: Error; readonly ok: false };

async function connectRedis(
  RedisConstructor: RedisModule["default"],
  url: string,
  keyPrefix: string,
  logs: string[],
): Promise<RedisConnectionResult> {
  let lastError = new Error("Redis health-check failed without a reported cause.");

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const candidate = new RedisConstructor(url, {
      family: 4,
      keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    candidate.on("error", (error) => {
      logs.push(`Redis client error on health-check attempt ${attempt}: ${errorMessage(error)}`);
    });

    try {
      await candidate.connect();
      await candidate.ping();
      return { client: candidate, ok: true };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      candidate.disconnect();
      logs.push(`Redis health-check attempt ${attempt} failed: ${errorMessage(error)}`);
      if (attempt < 5) {
        await delay(100 * attempt);
      }
    }
  }

  return { error: lastError, ok: false };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function cleanupFailedStart(
  client: RedisClient | undefined,
  container: StartedTestContainer,
  logs: string[],
): Promise<void> {
  try {
    client?.disconnect();
  } catch (error) {
    logs.push(`failed-start client cleanup: ${errorMessage(error)}`);
  }
  try {
    await container.stop();
  } catch (error) {
    logs.push(`failed-start container cleanup: ${errorMessage(error)}`);
  }
}

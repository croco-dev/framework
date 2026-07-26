import type { TokenIdentifier } from "@croco/framework-context";
import type { StartedTestResource, TestResource, TestResourceDiagnostic } from "@croco/testing";
import Redis from "ioredis";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
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
} from "./shared";

export type RedisTestConnection = {
  readonly client: Redis;
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

  return {
    id,
    async start(context): Promise<StartedTestResource<RedisTestConnection>> {
      const logs: string[] = [];
      const diagnostics: TestResourceDiagnostic[] = [];
      let container: StartedTestContainer | undefined;
      let client: Redis | undefined;

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

      try {
        client = await connectRedis(url, keyPrefix, logs);
        diagnostics.push(passedDiagnostic("health-check", "Redis responded to PING", logs));
      } catch (error) {
        diagnostics.push(failedDiagnostic("health-check", error, logs));
        await cleanupFailedStart(client, container, logs);
        throw new TestResourceLifecycleProblem(
          id,
          "health-check",
          errorMessage(error),
          logs,
          error,
        );
      }

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
            failures.push(error);
          }
          try {
            await stopContainer(id, container, logs, diagnostics);
          } catch (error) {
            failures.push(error);
          }
          if (failures.length > 0) {
            const failure = failures[0];
            diagnostics.push(failedDiagnostic("cleanup", failure, logs));
            throw new TestResourceLifecycleProblem(
              id,
              "cleanup",
              errorMessage(failure),
              logs,
              failure,
            );
          }
        },
        fidelity: {
          id,
          image,
          isolation: "prefix-per-test",
          kind: "redis",
          mode: "commit",
        },
      };
    },
  };
}

async function connectRedis(url: string, keyPrefix: string, logs: string[]): Promise<Redis> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const candidate = new Redis(url, {
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
      return candidate;
    } catch (error) {
      lastError = error;
      candidate.disconnect();
      logs.push(`Redis health-check attempt ${attempt} failed: ${errorMessage(error)}`);
      if (attempt < 5) {
        await delay(100 * attempt);
      }
    }
  }

  throw lastError;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function cleanupFailedStart(
  client: Redis | undefined,
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

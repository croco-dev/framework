import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TokenIdentifier } from "@croco/framework-context";
import type {
  StartedTestResource,
  TestResource,
  TestResourceDiagnostic,
  TestResourceMode,
} from "@croco/testing";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { TestResourceConfigurationProblem, TestResourceLifecycleProblem } from "./problems";
import type { TestResourceProvider } from "./providers";
import {
  appendContainerLogs,
  DEFAULT_POSTGRES_IMAGE,
  errorMessage,
  failedDiagnostic,
  isolationSuffix,
  passedDiagnostic,
  type ResourceImageOptions,
  resolveImage,
  stopContainer,
  throwCleanupFailures,
} from "./shared";

export type PostgresTestConnection = {
  readonly client?: PoolClient;
  readonly connectionString: string;
  readonly database: string;
  readonly host: string;
  readonly password: string;
  readonly pool: Pool;
  readonly port: number;
  readonly query: <TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => Promise<QueryResult<TRow>>;
  readonly username: string;
};

export type PostgresResourceOptions = ResourceImageOptions & {
  readonly id?: string;
  readonly migrations?: string;
  readonly mode: TestResourceMode;
  readonly password?: string;
  readonly provides?: TokenIdentifier<PostgresTestConnection>;
  readonly providers?: readonly TestResourceProvider<PostgresTestConnection>[];
  readonly startupTimeoutMs?: number;
  readonly username?: string;
};

export function postgresResource(
  options: PostgresResourceOptions,
): TestResource<PostgresTestConnection> {
  const id = options.id ?? "postgres";
  const image = resolveImage(id, DEFAULT_POSTGRES_IMAGE, options);
  const fidelity = {
    id,
    image,
    isolation: "database-per-worker",
    kind: "postgresql",
    mode: options.mode,
  } as const;
  if (options.mode === "migration" && !options.migrations) {
    throw new TestResourceConfigurationProblem(
      `PostgreSQL test resource '${id}' uses migration mode but has no migrations directory.`,
      { resourceId: id },
    );
  }

  return {
    fidelityHint: fidelity,
    id,
    async start(context): Promise<StartedTestResource<PostgresTestConnection>> {
      const logs: string[] = [];
      const diagnostics: TestResourceDiagnostic[] = [];
      const username = options.username ?? "postgres";
      const password = options.password ?? "postgres";
      const database = `croco_${isolationSuffix(context.workerId)}`;
      let container: StartedTestContainer | undefined;
      let pool: Pool | undefined;
      let client: PoolClient | undefined;

      try {
        container = await new GenericContainer(image)
          .withEnvironment({
            POSTGRES_DB: database,
            POSTGRES_PASSWORD: password,
            POSTGRES_USER: username,
          })
          .withExposedPorts(5432)
          .withLogConsumer(appendContainerLogs(logs))
          .withStartupTimeout(options.startupTimeoutMs ?? 120_000)
          .withWaitStrategy(
            Wait.forLogMessage(/database system is ready to accept connections/i, 2),
          )
          .start();
        diagnostics.push(passedDiagnostic("startup", "PostgreSQL container started", logs));
      } catch (error) {
        diagnostics.push(failedDiagnostic("startup", error, logs));
        throw new TestResourceLifecycleProblem(id, "startup", errorMessage(error), logs, error);
      }

      const host = container.getHost();
      const port = container.getMappedPort(5432);
      const connectionString = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

      try {
        pool = new Pool({ connectionString, max: 8 });
        await pool.query("select 1");
        diagnostics.push(passedDiagnostic("health-check", "PostgreSQL accepted a query", logs));
      } catch (error) {
        diagnostics.push(failedDiagnostic("health-check", error, logs));
        await cleanupFailedStart(id, client, pool, container, logs);
        throw new TestResourceLifecycleProblem(
          id,
          "health-check",
          errorMessage(error),
          logs,
          error,
        );
      }

      try {
        if (options.migrations) {
          await runSqlMigrations(pool, options.migrations, logs, diagnostics);
        }
      } catch (error) {
        diagnostics.push(failedDiagnostic("migration", error, logs));
        await cleanupFailedStart(id, client, pool, container, logs);
        throw new TestResourceLifecycleProblem(id, "migration", errorMessage(error), logs, error);
      }

      try {
        if (options.mode === "rollback") {
          client = await pool.connect();
          await client.query("begin");
        }
      } catch (error) {
        diagnostics.push(failedDiagnostic("startup", error, logs));
        await cleanupFailedStart(id, client, pool, container, logs);
        throw new TestResourceLifecycleProblem(id, "startup", errorMessage(error), logs, error);
      }

      const activePool = pool;
      const activeClient = client;
      const connection: PostgresTestConnection = {
        ...(activeClient ? { client: activeClient } : {}),
        connectionString,
        database,
        host,
        password,
        pool: activePool,
        port,
        query: async <TRow extends QueryResultRow = QueryResultRow>(
          text: string,
          values?: unknown[],
        ) =>
          activeClient
            ? activeClient.query<TRow>(text, values)
            : activePool.query<TRow>(text, values),
        username,
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
        await cleanupFailedStart(id, activeClient, activePool, container, logs);
        throw new TestResourceLifecycleProblem(id, "startup", errorMessage(error), logs, error);
      }

      return {
        connection,
        diagnostics,
        dispose: async () => {
          const failures: unknown[] = [];
          if (activeClient) {
            let discardClient = false;
            try {
              await activeClient.query("rollback");
            } catch (error) {
              discardClient = true;
              diagnostics.push(failedDiagnostic("cleanup", error, logs));
              failures.push(error);
            } finally {
              activeClient.release(discardClient);
            }
          }
          try {
            await activePool.end();
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

async function runSqlMigrations(
  pool: Pool,
  directory: string,
  logs: string[],
  diagnostics: TestResourceDiagnostic[],
): Promise<void> {
  const migrationDirectory = resolve(directory);
  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  if (migrationFiles.length === 0) {
    throw new TestResourceConfigurationProblem(
      `Migration directory '${migrationDirectory}' contains no .sql files.`,
      { migrationDirectory },
    );
  }

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(resolve(migrationDirectory, migrationFile), "utf8");
    await pool.query(sql);
    logs.push(`migration applied: ${migrationFile}`);
  }
  diagnostics.push(
    passedDiagnostic("migration", `${migrationFiles.length} migration(s) applied`, logs),
  );
}

async function cleanupFailedStart(
  resourceId: string,
  client: PoolClient | undefined,
  pool: Pool | undefined,
  container: StartedTestContainer,
  logs: string[],
): Promise<void> {
  try {
    client?.release();
  } catch (error) {
    logs.push(`failed-start client cleanup: ${resourceId}: ${errorMessage(error)}`);
  }
  try {
    await pool?.end();
  } catch (error) {
    logs.push(`failed-start pool cleanup: ${resourceId}: ${errorMessage(error)}`);
  }
  try {
    await container.stop();
  } catch (error) {
    logs.push(`failed-start container cleanup: ${resourceId}: ${errorMessage(error)}`);
  }
}

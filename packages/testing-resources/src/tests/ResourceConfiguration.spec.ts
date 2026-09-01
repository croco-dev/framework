import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { Container, Token } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import {
  DEFAULT_POSTGRES_IMAGE,
  DEFAULT_REDIS_IMAGE,
  type PostgresTestConnection,
  postgresResource,
  redisResource,
  type TestResourceProvider,
  TestResourceConfigurationProblem,
  TestResourceLifecycleProblem,
  TestResourceMissingDependencyProblem,
  testResourceProvider,
} from "../index";
import { loadTestResourceLiveDependency } from "../libs/liveDependencies";
import { appendContainerLogs, throwCleanupFailures } from "../libs/shared";

describe("testing resource configuration", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("uses digest-pinned first-party images", () => {
    expect(DEFAULT_POSTGRES_IMAGE).toMatch(/^postgres:16\.10-alpine@sha256:[a-f0-9]{64}$/);
    expect(DEFAULT_REDIS_IMAGE).toMatch(/^redis:7\.4\.5-alpine@sha256:[a-f0-9]{64}$/);
  });

  it("rejects unpinned overrides unless the caller explicitly opts out", () => {
    expect(() => postgresResource({ image: "postgres:16", mode: "commit" })).toThrow(
      TestResourceConfigurationProblem,
    );
    expect(() => redisResource({ image: "redis:7" })).toThrow(TestResourceConfigurationProblem);

    expect(
      postgresResource({
        allowUnpinnedImage: true,
        image: "postgres:16",
        mode: "commit",
      }).id,
    ).toBe("postgres");
  });

  it("requires migration input when migration fidelity is requested", () => {
    expect(() => postgresResource({ mode: "migration" })).toThrow(TestResourceConfigurationProblem);
  });

  it("preserves token value types in provider factories", () => {
    const token = new Token<string>("testing-resources.connection-string");
    const provider = testResourceProvider<PostgresTestConnection, string>(
      token,
      (connection) => connection.connectionString,
    );

    expect(provider.token).toBe(token);
  });

  it.each([
    {
      installCommand: "pnpm add -D pg@8.22.0 testcontainers@12.0.4",
      name: "pg for PostgreSQL",
      requirement: { dependency: "pg", resourceKind: "postgresql" },
    },
    {
      installCommand: "pnpm add -D ioredis@5.11.1 testcontainers@12.0.4",
      name: "ioredis for Redis",
      requirement: { dependency: "ioredis", resourceKind: "redis" },
    },
    {
      installCommand: "pnpm add -D pg@8.22.0 testcontainers@12.0.4",
      name: "testcontainers for PostgreSQL",
      requirement: { dependency: "testcontainers", resourceKind: "postgresql" },
    },
  ] as const)(
    "reports the $name recovery command when a live driver is missing",
    async ({ installCommand, requirement }) => {
      const { dependency, resourceKind } = requirement;
      const cause = Object.assign(
        new Error(`Cannot find package '${dependency}' imported from /consumer/test.mjs`),
        { code: "ERR_MODULE_NOT_FOUND" },
      );

      const result = loadTestResourceLiveDependency("resource", requirement, () =>
        Promise.reject(cause),
      );

      await expect(result).rejects.toBeInstanceOf(TestResourceMissingDependencyProblem);
      await expect(result).rejects.toMatchObject({
        category: ProblemCategory.InternalServerError,
        cause,
        code: "testing-resources/missing-live-dependency",
        extensions: {
          dependency,
          installCommand,
          resourceId: "resource",
          resourceKind,
        },
      });
    },
  );

  it("preserves nested module resolution failures from an installed live driver", async () => {
    const cause = Object.assign(
      new Error(
        "Cannot find package 'testcontainers-transitive-missing' imported from /consumer/node_modules/testcontainers/build/index.js",
      ),
      { code: "ERR_MODULE_NOT_FOUND" },
    );

    await expect(
      loadTestResourceLiveDependency(
        "postgres",
        { dependency: "testcontainers", resourceKind: "postgresql" },
        () => Promise.reject(cause),
      ),
    ).rejects.toBe(cause);
  });

  it("rejects live dependencies that do not match the resource kind at compile time", () => {
    const invalidRequirement = { dependency: "pg", resourceKind: "redis" } as const;
    const compileTimeCheck = () => {
      // @ts-expect-error Redis resources cannot require the PostgreSQL driver.
      new TestResourceMissingDependencyProblem("resource", invalidRequirement);
    };

    expect(compileTimeCheck).toBeTypeOf("function");
  });

  it("requires opaque provider construction through the typed factory", () => {
    // @ts-expect-error The private provider brand prevents token/value mismatches in object literals.
    const invalidProvider: TestResourceProvider<PostgresTestConnection> = {
      provide: () => 42,
      token: new Token<string>("testing-resources.invalid-provider"),
    };

    expect(invalidProvider.provide).toEqual(expect.any(Function));
  });

  it.each(["startup", "health-check", "migration", "cleanup"] as const)(
    "reports actionable %s diagnostics with bounded logs",
    (stage) => {
      const logs = Array.from({ length: 205 }, (_, index) => `log-${index}`);
      const problem = new TestResourceLifecycleProblem(
        "postgres",
        stage,
        "resource failed",
        logs,
        new Error("cause"),
      );

      expect(problem.code).toBe(`testing-resources/${stage}-failed`);
      expect(problem.extensions).toMatchObject({
        resourceId: "postgres",
        stage,
      });
      expect(problem.extensions?.recovery).toEqual(expect.any(String));
      expect(problem.extensions?.logs).toEqual(logs.slice(-200));
      expect(problem.cause).toEqual(new Error("cause"));
    },
  );

  it("bounds retained container logs while streaming", () => {
    const logs: string[] = [];
    const stream = new PassThrough();
    appendContainerLogs(logs)(stream);

    stream.write(Array.from({ length: 205 }, (_, index) => `log-${index}`).join("\n"));

    expect(logs).toHaveLength(200);
    expect(logs[0]).toBe("log-5");
    expect(logs.at(-1)).toBe("log-204");
  });

  it("preserves every cleanup failure as structured evidence", async () => {
    const failures = [new Error("transaction rollback failed"), new Error("pool closure failed")];

    await expect(
      Promise.resolve().then(() => throwCleanupFailures("postgres", failures, ["container log"])),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "testing-resources/cleanup-failed",
        extensions: expect.objectContaining({
          failureCount: 2,
          failures: [
            { message: "transaction rollback failed", name: "Error" },
            { message: "pool closure failed", name: "Error" },
          ],
        }),
      }),
    );
  });
});

import { Token } from "@croco/framework-context";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTGRES_IMAGE,
  DEFAULT_REDIS_IMAGE,
  type PostgresTestConnection,
  postgresResource,
  redisResource,
  type TestResourceProvider,
  TestResourceConfigurationProblem,
  TestResourceLifecycleProblem,
  testResourceProvider,
} from "../index";

describe("testing resource configuration", () => {
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
});

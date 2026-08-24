import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { GrantRequest } from "@croco/access-core";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleAccessProvider } from "../libs/DrizzleAccessProvider";
import { relationTuples } from "../schema/relationTuples";

type DrizzleAccessDb = ConstructorParameters<typeof DrizzleAccessProvider>[0];

function inspectSql(value: unknown): { params: unknown[]; text: string } {
  const sqlValue =
    value && typeof value === "object" && "getSQL" in value && typeof value.getSQL === "function"
      ? value.getSQL()
      : value;
  const { params, text } = collectSqlChunks(sqlValue);

  return {
    params,
    text: text.join(" ").replace(/\s+/g, " ").trim(),
  };
}

function collectSqlChunks(value: unknown): { params: unknown[]; text: string[] } {
  if (!value || typeof value !== "object" || !("queryChunks" in value)) {
    return value === undefined ? { params: [], text: [] } : { params: [value], text: [] };
  }

  const queryChunks = value.queryChunks;
  if (!Array.isArray(queryChunks)) {
    return { params: [], text: [] };
  }

  return queryChunks.reduce(
    (acc, chunk) => {
      const chunkValue =
        chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : undefined;

      if (Array.isArray(chunkValue) && chunkValue.every((item) => typeof item === "string")) {
        acc.text.push(...chunkValue);
        return acc;
      }

      if (chunkValue !== undefined) {
        acc.params.push(chunkValue);
        return acc;
      }

      const nested = collectSqlChunks(chunk);
      acc.params.push(...nested.params);
      acc.text.push(...nested.text);
      return acc;
    },
    { params: [] as unknown[], text: [] as string[] },
  );
}

function createReadinessCheck(providerName: string) {
  return {
    name: "redacts database connection details from readiness failures",
    run: async () => {
      const detail = `failed postgres://${providerName}:provider-secret@db.example/app?password=query-secret token=raw-token`;
      const indicator = new DrizzleHealthIndicator(
        {
          transaction: vi
            .fn()
            .mockRejectedValue(
              ProblemFactory.internalServerError("testing/drizzle-readiness-failed", detail),
            ),
        } as never,
        { name: providerName },
      );
      const health = await indicator.check();
      const serialized = JSON.stringify(health);

      expect(health.status).toBe("down");
      expect(serialized).not.toContain("provider-secret");
      expect(serialized).not.toContain("query-secret");
      expect(serialized).not.toContain("raw-token");
      expect(health.details?.error).toBe(
        "failed postgres://[redacted]@db.example/app?password=[redacted] token=[redacted]",
      );
    },
  };
}

describe("access-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "access-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares tenant-scoped relation tuple columns",
            run: async () => {
              const columns = getTableColumns(relationTuples);

              expect(Object.keys(columns)).toEqual(
                expect.arrayContaining([
                  "id",
                  "tenantId",
                  "object",
                  "relation",
                  "subject",
                  "createdAt",
                ]),
              );
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("access-drizzle")],
      },
      transaction: {
        participation: {
          supported: false,
          reason: "DrizzleAccessProvider accepts an execute-only client and no TxManager.",
        },
        rollback: {
          supported: false,
          reason: "Rollback is owned by the app-level Drizzle transaction boundary.",
        },
      },
      tenantIsolation: {
        supported: true,
        checks: [
          {
            name: "denies access when the tenant-scoped tuple is absent",
            run: async () => {
              const execute = vi.fn().mockResolvedValue({ rows: [{ allowed: 0 }] });
              const provider = new DrizzleAccessProvider({ execute } as DrizzleAccessDb);

              const result = await provider.check({
                tenantId: "tenant-b",
                subject: "user:alice",
                relation: "viewer",
                object: "document:doc-1",
              });

              expect(result.allowed).toBe(false);
              expect(result.decision).toBe("deny");
              expect(execute).toHaveBeenCalledTimes(1);
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "models missing relations as deterministic deny results",
              run: async () => {
                const provider = new DrizzleAccessProvider({
                  execute: vi.fn().mockResolvedValue({ rows: [] }),
                } as DrizzleAccessDb);

                await expect(
                  provider.check({
                    tenantId: "tenant-a",
                    subject: "user:missing",
                    relation: "viewer",
                    object: "document:missing",
                  }),
                ).resolves.toEqual({ decision: "deny", allowed: false });
              },
            },
          ],
        },
        validation: {
          supported: false,
          reason: "Access tuple validation is enforced by access-core before provider writes.",
        },
        duplicate: {
          supported: true,
          checks: [
            {
              name: "treats duplicate grants as idempotent writes",
              run: async () => {
                const execute = vi.fn().mockResolvedValue({ rows: [] });
                const provider = new DrizzleAccessProvider({ execute } as DrizzleAccessDb);
                const request: GrantRequest = {
                  tenantId: "tenant-a",
                  tuple: {
                    object: "document:doc-1",
                    relation: "viewer",
                    subject: "user:alice",
                  },
                };

                await expect(provider.grant(request)).resolves.toBeUndefined();
                await expect(provider.grant(request)).resolves.toBeUndefined();

                expect(execute).toHaveBeenCalledTimes(2);
                const grants = execute.mock.calls.map(([query]) => inspectSql(query));
                expect(grants.map((grant) => grant.params)).toEqual([
                  ["tenant-a", "document:doc-1", "viewer", "user:alice"],
                  ["tenant-a", "document:doc-1", "viewer", "user:alice"],
                ]);
                for (const grant of grants) {
                  expect(grant.text).toContain(
                    "ON CONFLICT (tenant_id, object, relation, subject) DO NOTHING",
                  );
                }
              },
            },
          ],
        },
        conflict: {
          supported: false,
          reason: "Duplicate tuple conflicts are normalized to ON CONFLICT DO NOTHING.",
        },
        retryableFailure: {
          supported: false,
          reason:
            "Retryable database failures are exposed through the app-level Drizzle health indicator.",
        },
      },
    }).cases,
  )("$name", async ({ run }) => {
    await run();
  });
});

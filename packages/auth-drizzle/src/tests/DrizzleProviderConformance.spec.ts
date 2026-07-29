import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import {
  assertDrizzleProblem,
  createDrizzleProviderConformanceSuite,
} from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleApiKeyStore } from "../libs/DrizzleApiKeyStore";
import { DrizzleRoleRegistry } from "../libs/DrizzleRoleRegistry";
import { apiKeys, sessions, tenantMappings, userRoles } from "../schema";

type DrizzleApiKeyDb = ConstructorParameters<typeof DrizzleApiKeyStore>[0];
type DrizzleRoleDb = ConstructorParameters<typeof DrizzleRoleRegistry>[0];

const createApiKeyRow = (tenantId = "tenant-a", id = `${tenantId}-key`) => ({
  id,
  prefix: `${tenantId}-prefix`,
  shortToken: `${tenantId}-short-token`,
  hash: "hash",
  permissions: ["read"],
  name: `${tenantId} Test key`,
  tenantId,
  createdBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  rateLimit: null,
  allowedIps: null,
});

function collectSqlParamValues(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || !("queryChunks" in value)) {
    return [];
  }

  const queryChunks = value.queryChunks;
  if (!Array.isArray(queryChunks)) {
    return [];
  }

  return queryChunks.flatMap((chunk) => {
    const chunkValue =
      chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : undefined;

    if (chunkValue !== undefined && !Array.isArray(chunkValue)) {
      return [chunkValue];
    }

    return collectSqlParamValues(chunk);
  });
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

describe("auth-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "auth-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares auth tables with tenant-scoped API keys and roles",
            run: async () => {
              expect(Object.keys(getTableColumns(apiKeys))).toEqual(
                expect.arrayContaining(["id", "shortToken", "hash", "tenantId", "createdBy"]),
              );
              expect(Object.keys(getTableColumns(sessions))).toEqual(
                expect.arrayContaining(["id", "userId", "clientId", "status"]),
              );
              expect(Object.keys(getTableColumns(tenantMappings))).toEqual(
                expect.arrayContaining(["id", "externalOrgId", "tenantId"]),
              );
              expect(Object.keys(getTableColumns(userRoles))).toEqual(
                expect.arrayContaining(["id", "userId", "tenantId", "role"]),
              );
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("auth-drizzle")],
      },
      transaction: {
        participation: {
          supported: false,
          reason: "Auth Drizzle stores accept direct Drizzle query clients and no TxManager.",
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
            name: "lists API keys through the tenant-scoped lookup",
            run: async () => {
              const rowsByTenant = new Map([
                ["tenant-a", [createApiKeyRow("tenant-a")]],
                ["tenant-b", [createApiKeyRow("tenant-b")]],
              ]);
              const findMany = vi.fn(async ({ where }: { where: unknown }) => {
                const tenantId = collectSqlParamValues(where).find(
                  (param) => param === "tenant-a" || param === "tenant-b",
                );

                return rowsByTenant.get(String(tenantId)) ?? [];
              });
              const store = new DrizzleApiKeyStore(
                {
                  insert: vi.fn(),
                  update: vi.fn(),
                  delete: vi.fn(),
                  query: {
                    apiKeys: {
                      findFirst: vi.fn(),
                      findMany,
                    },
                  },
                } as unknown as DrizzleApiKeyDb,
                { apiKeys },
              );

              const tenantAKeys = await store.listByTenant("tenant-a");
              const tenantBKeys = await store.listByTenant("tenant-b");

              expect(tenantAKeys.map((key) => key.tenantId)).toEqual(["tenant-a"]);
              expect(tenantBKeys.map((key) => key.tenantId)).toEqual(["tenant-b"]);
              expect(findMany).toHaveBeenCalledTimes(2);
              expect(
                findMany.mock.calls.map(([args]) => collectSqlParamValues(args.where)),
              ).toEqual([["tenant-a"], ["tenant-b"]]);
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null for missing API keys",
              run: async () => {
                const store = new DrizzleApiKeyStore(
                  {
                    insert: vi.fn(),
                    update: vi.fn(),
                    delete: vi.fn(),
                    query: {
                      apiKeys: {
                        findFirst: vi.fn().mockResolvedValue(null),
                        findMany: vi.fn(),
                      },
                    },
                  } as unknown as DrizzleApiKeyDb,
                  { apiKeys },
                );

                await expect(store.findById("missing-key")).resolves.toBeNull();
              },
            },
          ],
        },
        validation: {
          supported: true,
          checks: [
            {
              name: "normalizes invalid inserted API key rows to a stable Problem",
              run: async () => {
                const store = new DrizzleApiKeyStore(
                  {
                    insert: vi.fn().mockReturnValue({
                      values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ invalid: "row" }]),
                      }),
                    }),
                    update: vi.fn(),
                    delete: vi.fn(),
                    query: {
                      apiKeys: {
                        findFirst: vi.fn(),
                        findMany: vi.fn(),
                      },
                    },
                  } as unknown as DrizzleApiKeyDb,
                  { apiKeys },
                );

                await assertDrizzleProblem(
                  () =>
                    store.save({
                      prefix: "test",
                      shortToken: "short-token",
                      hash: "hash",
                      permissions: ["read"],
                      name: "Test key",
                      tenantId: "tenant-a",
                      createdBy: "user-1",
                      expiresAt: null,
                      revokedAt: null,
                      lastUsedAt: null,
                    }),
                  {
                    code: "auth-core/api-key-creation-failed",
                    status: 500,
                  },
                );
              },
            },
          ],
        },
        duplicate: {
          supported: true,
          checks: [
            {
              name: "deduplicates role assignment through ON CONFLICT DO NOTHING",
              run: async () => {
                const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
                const registry = new DrizzleRoleRegistry(
                  {
                    insert: vi.fn().mockReturnValue({
                      values: vi.fn().mockReturnValue({
                        onConflictDoNothing,
                      }),
                    }),
                    delete: vi.fn(),
                    query: {
                      userRoles: {
                        findMany: vi.fn(),
                      },
                    },
                  } as DrizzleRoleDb,
                  { userRoles },
                );

                await registry.assignRole("user-1", "tenant-a", "admin");

                expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
              },
            },
          ],
        },
        conflict: {
          supported: false,
          reason: "Role duplicates are deterministic idempotent no-op writes.",
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

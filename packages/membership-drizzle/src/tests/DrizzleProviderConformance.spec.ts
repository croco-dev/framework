import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleMembershipStore } from "../libs/DrizzleMembershipStore";
import { memberships } from "../libs/schema";

type DrizzleMembershipClient = ConstructorParameters<typeof DrizzleMembershipStore>[0];
type MembershipTxManager = ConstructorParameters<typeof DrizzleMembershipStore>[1];
type MembershipSaveInput = Parameters<DrizzleMembershipStore["save"]>[0];

const createInput = (tenantId = "tenant-a"): MembershipSaveInput => ({
  id: "membership-1",
  tenantId,
  userId: "user-1",
  role: "member",
});

const createMembershipRow = (tenantId = "tenant-a") => ({
  ...createInput(tenantId),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

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

describe("membership-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "membership-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares tenant and user unique membership columns",
            run: async () => {
              const columns = getTableColumns(memberships);

              expect(Object.keys(columns)).toEqual(
                expect.arrayContaining([
                  "id",
                  "tenantId",
                  "userId",
                  "role",
                  "createdAt",
                  "updatedAt",
                ]),
              );
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("membership-drizzle")],
      },
      transaction: {
        participation: {
          supported: true,
          checks: [
            {
              name: "uses the active transaction client for writes",
              run: async () => {
                const returning = vi.fn().mockResolvedValue([createMembershipRow()]);
                const txClient = {
                  insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                      onConflictDoUpdate: vi.fn().mockReturnValue({ returning }),
                    }),
                  }),
                };
                const fallbackClient = {
                  insert: vi.fn(() => {
                    throw ProblemFactory.internalServerError(
                      "testing/fallback-client-used",
                      "fallback client used",
                    );
                  }),
                };
                const store = new DrizzleMembershipStore(
                  fallbackClient as unknown as DrizzleMembershipClient,
                  {
                    getClient: vi.fn().mockReturnValue(txClient),
                  } as unknown as MembershipTxManager,
                );

                await store.save(createInput());

                expect(txClient.insert).toHaveBeenCalledTimes(1);
                expect(fallbackClient.insert).not.toHaveBeenCalled();
              },
            },
          ],
        },
        rollback: {
          supported: false,
          reason:
            "Rollback is covered at the TxManager adapter boundary for this query-double suite.",
        },
      },
      tenantIsolation: {
        supported: true,
        checks: [
          {
            name: "lists memberships through the tenant-scoped lookup",
            run: async () => {
              const store = new DrizzleMembershipStore(
                {
                  select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                      where: vi.fn().mockResolvedValue([createMembershipRow("tenant-a")]),
                    }),
                  }),
                } as unknown as DrizzleMembershipClient,
                {
                  getClient: vi.fn().mockReturnValue(null),
                } as unknown as MembershipTxManager,
              );

              const memberships = await store.findAllByTenant("tenant-a");

              expect(memberships).toHaveLength(1);
              expect(memberships[0]?.tenantId).toBe("tenant-a");
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null for missing tenant user membership",
              run: async () => {
                const store = new DrizzleMembershipStore(
                  {
                    select: vi.fn().mockReturnValue({
                      from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                          limit: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    }),
                  } as unknown as DrizzleMembershipClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as MembershipTxManager,
                );

                await expect(
                  store.findByTenantAndUser("tenant-a", "missing-user"),
                ).resolves.toBeNull();
              },
            },
          ],
        },
        validation: {
          supported: false,
          reason: "Membership role validation is enforced by membership-core before store writes.",
        },
        duplicate: {
          supported: true,
          checks: [
            {
              name: "upserts duplicate tenant user memberships deterministically",
              run: async () => {
                const onConflictDoUpdate = vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([createMembershipRow()]),
                });
                const store = new DrizzleMembershipStore(
                  {
                    insert: vi.fn().mockReturnValue({
                      values: vi.fn().mockReturnValue({ onConflictDoUpdate }),
                    }),
                  } as unknown as DrizzleMembershipClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as MembershipTxManager,
                );

                await store.save(createInput());

                expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
              },
            },
          ],
        },
        conflict: {
          supported: false,
          reason: "Membership duplicate conflicts are normalized to upserts.",
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

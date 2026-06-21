import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleDomainPolicyStore } from "../libs/DrizzleDomainPolicyStore";
import { DrizzleInvitationStore } from "../libs/DrizzleInvitationStore";
import { domainPolicies, invitations } from "../libs/schema";

type DrizzleInvitationClient = ConstructorParameters<typeof DrizzleInvitationStore>[0];
type InvitationTxManager = ConstructorParameters<typeof DrizzleInvitationStore>[1];
type DrizzleDomainPolicyClient = ConstructorParameters<typeof DrizzleDomainPolicyStore>[0];
type InvitationRecord = Parameters<DrizzleInvitationStore["save"]>[0];

const createInvitation = (tenantId = "tenant-a"): InvitationRecord => ({
  id: "invitation-1",
  tenantId,
  inviterId: "user-1",
  email: "member@example.com",
  tokenHash: "token-hash",
  type: "email",
  role: "member",
  status: "pending",
  expiresAt: new Date("2026-02-01T00:00:00.000Z"),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
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

describe("invitation-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "invitation-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares invitation and domain policy tenant boundaries",
            run: async () => {
              expect(Object.keys(getTableColumns(invitations))).toEqual(
                expect.arrayContaining([
                  "id",
                  "tenantId",
                  "tokenHash",
                  "status",
                  "expiresAt",
                  "createdAt",
                ]),
              );
              expect(Object.keys(getTableColumns(domainPolicies))).toEqual(
                expect.arrayContaining(["id", "tenantId", "domain", "role", "enabled"]),
              );
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("invitation-drizzle")],
      },
      transaction: {
        participation: {
          supported: true,
          checks: [
            {
              name: "uses the active transaction client for invitation writes",
              run: async () => {
                const returning = vi.fn().mockResolvedValue([createInvitation()]);
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
                const store = new DrizzleInvitationStore(
                  fallbackClient as unknown as DrizzleInvitationClient,
                  {
                    getClient: vi.fn().mockReturnValue(txClient),
                  } as unknown as InvitationTxManager,
                );

                await store.save(createInvitation());

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
            name: "lists invitations through tenant-scoped queries",
            run: async () => {
              const store = new DrizzleInvitationStore(
                {
                  select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                      where: vi.fn().mockResolvedValue([createInvitation("tenant-a")]),
                    }),
                  }),
                } as unknown as DrizzleInvitationClient,
                {
                  getClient: vi.fn().mockReturnValue(null),
                } as unknown as InvitationTxManager,
              );

              const invitations = await store.findAllByTenant("tenant-a");

              expect(invitations).toHaveLength(1);
              expect(invitations[0]?.tenantId).toBe("tenant-a");
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null for missing invitations and domain policies",
              run: async () => {
                const invitationStore = new DrizzleInvitationStore(
                  {
                    select: vi.fn().mockReturnValue({
                      from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                          limit: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    }),
                  } as unknown as DrizzleInvitationClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as InvitationTxManager,
                );
                const policyStore = new DrizzleDomainPolicyStore(
                  {
                    select: vi.fn().mockReturnValue({
                      from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                          limit: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    }),
                  } as unknown as DrizzleDomainPolicyClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as never,
                );

                await expect(invitationStore.findById("missing-invitation")).resolves.toBeNull();
                await expect(
                  policyStore.findByTenantAndDomain("tenant-a", "example.com"),
                ).resolves.toBeNull();
              },
            },
          ],
        },
        validation: {
          supported: false,
          reason: "Invitation role, status, and token validation is enforced by invitation-core.",
        },
        duplicate: {
          supported: true,
          checks: [
            {
              name: "upserts duplicate invitation tokens deterministically",
              run: async () => {
                const onConflictDoUpdate = vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([createInvitation()]),
                });
                const store = new DrizzleInvitationStore(
                  {
                    insert: vi.fn().mockReturnValue({
                      values: vi.fn().mockReturnValue({ onConflictDoUpdate }),
                    }),
                  } as unknown as DrizzleInvitationClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as InvitationTxManager,
                );

                await store.save(createInvitation());

                expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
              },
            },
          ],
        },
        conflict: {
          supported: true,
          checks: [
            {
              name: "returns null for stale compare-and-set status updates",
              run: async () => {
                const store = new DrizzleInvitationStore(
                  {
                    update: vi.fn().mockReturnValue({
                      set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                          returning: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    }),
                  } as unknown as DrizzleInvitationClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as InvitationTxManager,
                );

                await expect(
                  store.compareAndSetStatus("tenant-a", "invitation-1", "pending", "accepted"),
                ).resolves.toBeNull();
              },
            },
          ],
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

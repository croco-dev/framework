import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { OnboardingState } from "@croco/onboarding-core";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleOnboardingStore } from "../libs/DrizzleOnboardingStore";
import { onboardingStates } from "../libs/schema";

type DrizzleOnboardingClient = ConstructorParameters<typeof DrizzleOnboardingStore>[0];
type OnboardingTxManager = ConstructorParameters<typeof DrizzleOnboardingStore>[1];

const onboardingState: OnboardingState = {
  steps: {
    "workspace-created": {
      completed: true,
    },
  },
  isCompleted: false,
  completedAt: undefined,
};

const onboardingRow = {
  tenantId: "tenant-a",
  userId: "user-1",
  onboardingId: "default",
  steps: onboardingState.steps,
  isCompleted: onboardingState.isCompleted,
  completedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

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

describe("onboarding-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "onboarding-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares composite tenant user onboarding state columns",
            run: async () => {
              const columns = getTableColumns(onboardingStates);

              expect(Object.keys(columns)).toEqual(
                expect.arrayContaining([
                  "tenantId",
                  "userId",
                  "onboardingId",
                  "steps",
                  "isCompleted",
                  "completedAt",
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
        checks: [createReadinessCheck("onboarding-drizzle")],
      },
      transaction: {
        participation: {
          supported: true,
          checks: [
            {
              name: "uses the active transaction client for state writes",
              run: async () => {
                const txClient = {
                  insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
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
                const store = new DrizzleOnboardingStore(
                  fallbackClient as unknown as DrizzleOnboardingClient,
                  {
                    getClient: vi.fn().mockReturnValue(txClient),
                  } as unknown as OnboardingTxManager,
                );

                await store.saveState("tenant-a", "user-1", "default", onboardingState);

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
            name: "loads onboarding state through the tenant user onboarding key",
            run: async () => {
              const store = new DrizzleOnboardingStore(
                {
                  select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                      where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([onboardingRow]),
                      }),
                    }),
                  }),
                } as unknown as DrizzleOnboardingClient,
                {
                  getClient: vi.fn().mockReturnValue(null),
                } as unknown as OnboardingTxManager,
              );

              const state = await store.getState("tenant-a", "user-1", "default");

              expect(state?.steps).toEqual(onboardingState.steps);
              expect(state?.isCompleted).toBe(false);
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null for missing onboarding state",
              run: async () => {
                const store = new DrizzleOnboardingStore(
                  {
                    select: vi.fn().mockReturnValue({
                      from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                          limit: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    }),
                  } as unknown as DrizzleOnboardingClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as OnboardingTxManager,
                );

                await expect(store.getState("tenant-a", "user-1", "missing")).resolves.toBeNull();
              },
            },
          ],
        },
        validation: {
          supported: false,
          reason: "Onboarding state shape validation is enforced by onboarding-core.",
        },
        duplicate: {
          supported: true,
          checks: [
            {
              name: "upserts duplicate onboarding state keys deterministically",
              run: async () => {
                const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
                const store = new DrizzleOnboardingStore(
                  {
                    insert: vi.fn().mockReturnValue({
                      values: vi.fn().mockReturnValue({ onConflictDoUpdate }),
                    }),
                  } as unknown as DrizzleOnboardingClient,
                  {
                    getClient: vi.fn().mockReturnValue(null),
                  } as unknown as OnboardingTxManager,
                );

                await store.saveState("tenant-a", "user-1", "default", onboardingState);

                expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
              },
            },
          ],
        },
        conflict: {
          supported: false,
          reason: "Onboarding state duplicates are normalized to upserts.",
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

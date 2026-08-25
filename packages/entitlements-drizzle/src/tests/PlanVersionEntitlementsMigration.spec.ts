import { planVersionRef } from "@croco/billing-core";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  addPlanVersionEntitlementsPostgres,
  backfillPlanVersionEntitlementsPostgres,
  type EntitlementMigrationClient,
} from "../migrations/addPlanVersionEntitlements";

describe("plan-version entitlement migrations", () => {
  it("adds version schema before applying an explicit backfill mapping", async () => {
    const dialect = new PgDialect();
    const execute = vi.fn(async (query: SQL) => {
      const statement = dialect.sqlToQuery(query).sql;
      if (statement.includes("SELECT id, feature_key")) {
        return { rows: [validCandidateRow()] };
      }
      if (statement.includes("UPDATE plan_entitlements")) {
        return { rows: [{ id: "entitlement-1" }] };
      }
      return { rows: [] };
    });
    const transactionCalls = vi.fn();
    const transaction: NonNullable<EntitlementMigrationClient["transaction"]> = async <T>(
      migrate: (tx: EntitlementMigrationClient) => Promise<T>,
    ): Promise<T> => {
      transactionCalls();
      return migrate({ execute });
    };
    const client: EntitlementMigrationClient = { execute, transaction };

    await addPlanVersionEntitlementsPostgres(client);
    await backfillPlanVersionEntitlementsPostgres(client, [
      {
        planId: "pro",
        planVersionRef: planVersionRef("pro@2026-01"),
      },
    ]);

    expect(transactionCalls).toHaveBeenCalledTimes(2);
    expect(
      execute.mock.calls.some(([query]) =>
        dialect.sqlToQuery(query).sql.includes("plan_entitlements_legacy_plan_feature_unique"),
      ),
    ).toBe(true);
  });

  it("reports legacy duplicate plan and feature identifiers before creating the index", async () => {
    const dialect = new PgDialect();
    const statements: string[] = [];
    const execute = vi.fn(async (query: SQL) => {
      const statement = dialect.sqlToQuery(query).sql;
      statements.push(statement);
      if (statement.includes("GROUP BY plan_id, feature_key")) {
        return {
          rows: [{ plan_id: "pro", feature_key: "reports", duplicate_count: 2 }],
        };
      }
      return { rows: [] };
    });
    const transaction: NonNullable<EntitlementMigrationClient["transaction"]> = async <T>(
      migrate: (tx: EntitlementMigrationClient) => Promise<T>,
    ): Promise<T> => migrate({ execute });

    await expect(addPlanVersionEntitlementsPostgres({ execute, transaction })).rejects.toThrow(
      "plan 'pro', feature 'reports' (2 rows)",
    );
    expect(
      statements.some((statement) =>
        statement.includes("plan_entitlements_legacy_plan_feature_unique"),
      ),
    ).toBe(false);
  });

  it("rejects ambiguous or legacy mappings instead of selecting a version", async () => {
    const client: EntitlementMigrationClient = {
      execute: vi.fn(async () => undefined),
    };

    await expect(
      backfillPlanVersionEntitlementsPostgres(client, [
        { planId: "pro", planVersionRef: planVersionRef("pro@2026-01") },
        { planId: "pro", planVersionRef: planVersionRef("pro@2026-07") },
      ]),
    ).rejects.toMatchObject({ code: "entitlements-core/definition-invalid" });
    await expect(
      backfillPlanVersionEntitlementsPostgres(client, [
        { planId: "pro", planVersionRef: planVersionRef("legacy:pro") },
      ]),
    ).rejects.toMatchObject({ code: "entitlements-core/definition-invalid" });
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("requires a transaction before a valid backfill mutates rows", async () => {
    const client: EntitlementMigrationClient = {
      execute: vi.fn(async () => undefined),
    };

    await expect(
      backfillPlanVersionEntitlementsPostgres(client, [
        { planId: "pro", planVersionRef: planVersionRef("pro@2026-01") },
      ]),
    ).rejects.toMatchObject({ code: "entitlements-core/definition-invalid" });
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("rejects a plan version already owned by another plan before updating rows", async () => {
    let executeCall = 0;
    const execute = vi.fn(async () => {
      executeCall += 1;
      return executeCall === 3 ? { rows: [{ plan_id: "enterprise" }] } : { rows: [] };
    });
    const transaction: NonNullable<EntitlementMigrationClient["transaction"]> = async <T>(
      migrate: (tx: EntitlementMigrationClient) => Promise<T>,
    ): Promise<T> => migrate({ execute });

    await expect(
      backfillPlanVersionEntitlementsPostgres({ execute, transaction }, [
        { planId: "pro", planVersionRef: planVersionRef("shared@2026-01") },
      ]),
    ).rejects.toMatchObject({ code: "entitlements-core/plan-version-mismatch" });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("rejects dynamic-quota and unbound-overage legacy rows before mutation", async () => {
    for (const candidate of [
      { ...validCandidateRow(), quota: null },
      {
        ...validCandidateRow(),
        overage_policy: "allow",
        meter_id: "api_calls",
        meter_billing: null,
      },
    ]) {
      let executeCall = 0;
      const execute = vi.fn(async () => {
        executeCall += 1;
        return executeCall === 5 ? { rows: [candidate] } : { rows: [] };
      });
      const transaction: NonNullable<EntitlementMigrationClient["transaction"]> = async <T>(
        migrate: (tx: EntitlementMigrationClient) => Promise<T>,
      ): Promise<T> => migrate({ execute });

      await expect(
        backfillPlanVersionEntitlementsPostgres({ execute, transaction }, [
          { planId: "pro", planVersionRef: planVersionRef("pro@2026-01") },
        ]),
      ).rejects.toMatchObject({ code: "entitlements-core/definition-invalid" });
      expect(execute).toHaveBeenCalledTimes(5);
    }
  });

  it("rejects mapping a plan whose rows are already assigned to another version", async () => {
    let executeCall = 0;
    const execute = vi.fn(async () => {
      executeCall += 1;
      return executeCall === 4 ? { rows: [{ plan_version_ref: "pro@2025-01" }] } : { rows: [] };
    });
    const transaction: NonNullable<EntitlementMigrationClient["transaction"]> = async <T>(
      migrate: (tx: EntitlementMigrationClient) => Promise<T>,
    ): Promise<T> => migrate({ execute });

    await expect(
      backfillPlanVersionEntitlementsPostgres({ execute, transaction }, [
        { planId: "pro", planVersionRef: planVersionRef("pro@2026-01") },
      ]),
    ).rejects.toMatchObject({ code: "entitlements-core/definition-invalid" });
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("requires an explicit opt-in before publishing an empty entitlement set", async () => {
    const createClient = (): EntitlementMigrationClient => {
      const execute = vi.fn(async () => ({ rows: [] }));
      return {
        execute,
        transaction: async <T>(
          migrate: (tx: EntitlementMigrationClient) => Promise<T>,
        ): Promise<T> => migrate({ execute }),
      };
    };
    const rejectedClient = createClient();

    await expect(
      backfillPlanVersionEntitlementsPostgres(rejectedClient, [
        { planId: "pro", planVersionRef: planVersionRef("pro@2026-01") },
      ]),
    ).rejects.toMatchObject({ code: "entitlements-core/definition-invalid" });

    const allowedClient = createClient();
    await expect(
      backfillPlanVersionEntitlementsPostgres(allowedClient, [
        {
          planId: "pro",
          planVersionRef: planVersionRef("pro@2026-01"),
          allowEmpty: true,
        },
      ]),
    ).resolves.toBeUndefined();
  });
});

function validCandidateRow(): Record<string, unknown> {
  return {
    id: "entitlement-1",
    feature_key: "api_calls",
    type: "metered",
    value: null,
    meter_id: "api_calls",
    meter_billing: "local",
    quota: 100,
    overage_policy: "block",
  };
}

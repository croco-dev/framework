import type { PlanVersionRef } from "@croco/billing-core";
import {
  EntitlementDefinitionProblem,
  EntitlementPlanVersionMismatchProblem,
} from "@croco/entitlements-core";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export type EntitlementMigrationClient = {
  execute(query: SQL): Promise<unknown>;
  transaction?<T>(fn: (tx: EntitlementMigrationClient) => Promise<T>): Promise<T>;
};

export type PlanVersionEntitlementMigrationMapping = {
  readonly planId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly allowEmpty?: boolean;
};

/**
 * PostgreSQL entitlement tables에 immutable plan-version identity를 추가합니다.
 *
 * 기존 행을 임의 버전에 연결하지 않도록 새 컬럼은 nullable로 추가됩니다. 이후
 * `backfillPlanVersionEntitlementsPostgres`에 운영자가 검증한 명시적 mapping을 전달해야 합니다.
 */
export async function addPlanVersionEntitlementsPostgres(
  db: EntitlementMigrationClient,
): Promise<void> {
  await runMigration(db, async (tx) => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_entitlement_sets (
        plan_version_ref TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT plan_entitlement_sets_version_plan_unique
          UNIQUE (plan_version_ref, plan_id)
      )
    `);
    await tx.execute(
      sql`ALTER TABLE plan_entitlements ADD COLUMN IF NOT EXISTS plan_version_ref TEXT`,
    );
    await tx.execute(
      sql`ALTER TABLE plan_entitlements ADD COLUMN IF NOT EXISTS meter_billing TEXT`,
    );
    await tx.execute(
      sql`CREATE INDEX IF NOT EXISTS plan_entitlements_plan_version_ref_idx
          ON plan_entitlements (plan_version_ref)`,
    );
    await tx.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS plan_entitlements_version_feature_unique
          ON plan_entitlements (plan_version_ref, feature_key)
          WHERE plan_version_ref IS NOT NULL`,
    );
    await tx.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'plan_entitlement_sets_version_plan_unique'
            AND conrelid = 'plan_entitlement_sets'::regclass
        ) THEN
          ALTER TABLE plan_entitlement_sets
          ADD CONSTRAINT plan_entitlement_sets_version_plan_unique
          UNIQUE (plan_version_ref, plan_id);
        END IF;
      END
      $$
    `);
    await tx.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'plan_entitlements_version_plan_fk'
            AND conrelid = 'plan_entitlements'::regclass
        ) THEN
          ALTER TABLE plan_entitlements
          ADD CONSTRAINT plan_entitlements_version_plan_fk
          FOREIGN KEY (plan_version_ref, plan_id)
          REFERENCES plan_entitlement_sets (plan_version_ref, plan_id)
          NOT VALID;
        END IF;
      END
      $$
    `);
    await tx.execute(
      sql`ALTER TABLE plan_entitlements
          VALIDATE CONSTRAINT plan_entitlements_version_plan_fk`,
    );
  });
}

/**
 * 운영자가 선택한 exact `PlanVersionRef` mapping으로 legacy entitlement 행을 backfill합니다.
 *
 * 이 함수는 최신 plan version을 조회하거나 추정하지 않습니다.
 */
export async function backfillPlanVersionEntitlementsPostgres(
  db: EntitlementMigrationClient,
  mappings: readonly PlanVersionEntitlementMigrationMapping[],
): Promise<void> {
  validateMappings(mappings);
  if (!db.transaction) {
    throw new EntitlementDefinitionProblem(
      "Plan-version entitlement backfill requires transactional migration support.",
    );
  }

  await db.transaction(async (tx) => {
    const orderedMappings = [...mappings].sort((left, right) =>
      `${left.planId}\u0000${left.planVersionRef}`.localeCompare(
        `${right.planId}\u0000${right.planVersionRef}`,
      ),
    );
    for (const mapping of orderedMappings) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(
          hashtextextended(${"entitlements:plan:" + mapping.planId}, 0)
        )`,
      );
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(
          hashtextextended(${"entitlements:version:" + mapping.planVersionRef}, 0)
        )`,
      );
      const existingResult = await tx.execute(sql`
        SELECT plan_id
        FROM plan_entitlement_sets
        WHERE plan_version_ref = ${mapping.planVersionRef}
        FOR UPDATE
      `);
      const existingPlanId = readFirstPlanId(existingResult);
      if (existingPlanId !== null && existingPlanId !== mapping.planId) {
        throw new EntitlementPlanVersionMismatchProblem(
          mapping.planVersionRef,
          mapping.planId,
          existingPlanId,
        );
      }
      const assignedRows = readRows(
        await tx.execute(sql`
          SELECT plan_version_ref
          FROM plan_entitlements
          WHERE plan_id = ${mapping.planId}
            AND plan_version_ref IS NOT NULL
          FOR UPDATE
        `),
      );
      const assignedRefs = new Set(
        assignedRows.flatMap((row) =>
          typeof row.plan_version_ref === "string" ? [row.plan_version_ref] : [],
        ),
      );
      for (const assignedRef of assignedRefs) {
        if (assignedRef !== mapping.planVersionRef) {
          throw new EntitlementDefinitionProblem(
            `Plan '${mapping.planId}' already has entitlements assigned to plan version '${assignedRef}'.`,
          );
        }
      }

      const candidateRows = readRows(
        await tx.execute(sql`
          SELECT id, feature_key, type, value, meter_id, meter_billing, quota, overage_policy
          FROM plan_entitlements
          WHERE plan_id = ${mapping.planId}
            AND plan_version_ref IS NULL
          FOR UPDATE
        `),
      );
      validateCandidateRows(mapping.planId, candidateRows);
      if (
        candidateRows.length === 0 &&
        existingPlanId === null &&
        assignedRefs.size === 0 &&
        mapping.allowEmpty !== true
      ) {
        throw new EntitlementDefinitionProblem(
          `Plan '${mapping.planId}' has no legacy entitlement rows; set allowEmpty to publish an empty set.`,
        );
      }

      await tx.execute(sql`
        INSERT INTO plan_entitlement_sets (plan_version_ref, plan_id)
        VALUES (${mapping.planVersionRef}, ${mapping.planId})
        ON CONFLICT (plan_version_ref) DO NOTHING
      `);
      const updatedRows = readRows(
        await tx.execute(sql`
        UPDATE plan_entitlements
        SET plan_version_ref = ${mapping.planVersionRef}
        WHERE plan_id = ${mapping.planId}
          AND plan_version_ref IS NULL
        RETURNING id
      `),
      );
      if (updatedRows.length !== candidateRows.length) {
        throw new EntitlementDefinitionProblem(
          `Plan '${mapping.planId}' entitlement rows changed during plan-version backfill.`,
        );
      }
    }
  });
}

function readFirstPlanId(result: unknown): string | null {
  const row = readRows(result)[0];
  return row && typeof row.plan_id === "string" ? row.plan_id : null;
}

function readRows(result: unknown): Record<string, unknown>[] {
  const rows =
    typeof result === "object" && result !== null && "rows" in result && Array.isArray(result.rows)
      ? result.rows
      : Array.isArray(result)
        ? result
        : [];
  return rows.filter(
    (row): row is Record<string, unknown> => typeof row === "object" && row !== null,
  );
}

function validateCandidateRows(planId: string, rows: readonly Record<string, unknown>[]): void {
  const featureKeys = new Set<string>();
  for (const row of rows) {
    const featureKey = row.feature_key;
    const type = row.type;
    const overagePolicy = row.overage_policy;
    if (typeof featureKey !== "string" || featureKey.trim().length === 0) {
      throw invalidCandidate(planId, "contains an empty feature key");
    }
    if (featureKeys.has(featureKey)) {
      throw invalidCandidate(planId, `declares feature '${featureKey}' more than once`);
    }
    if (type !== "boolean" && type !== "metered" && type !== "static") {
      throw invalidCandidate(planId, `has unknown type '${String(type)}' for '${featureKey}'`);
    }
    if (type === "static" && typeof row.value !== "number") {
      throw invalidCandidate(planId, `requires a static value for '${featureKey}'`);
    }
    if (type === "metered" && typeof row.quota !== "number") {
      throw invalidCandidate(planId, `requires an inline quota for '${featureKey}'`);
    }
    if (
      overagePolicy !== null &&
      overagePolicy !== "block" &&
      overagePolicy !== "warn" &&
      overagePolicy !== "allow" &&
      overagePolicy !== "BLOCK" &&
      overagePolicy !== "WARN" &&
      overagePolicy !== "ALLOW_WITH_OVERAGE"
    ) {
      throw invalidCandidate(
        planId,
        `has unknown overage policy '${String(overagePolicy)}' for '${featureKey}'`,
      );
    }
    if (
      (overagePolicy === "allow" || overagePolicy === "ALLOW_WITH_OVERAGE") &&
      (typeof row.meter_id !== "string" || row.meter_billing !== "required")
    ) {
      throw invalidCandidate(
        planId,
        `allows billable overage without a billing-required meter for '${featureKey}'`,
      );
    }
    featureKeys.add(featureKey);
  }
}

function invalidCandidate(planId: string, detail: string): EntitlementDefinitionProblem {
  return new EntitlementDefinitionProblem(
    `Legacy entitlement rows for plan '${planId}' ${detail}.`,
  );
}

function validateMappings(mappings: readonly PlanVersionEntitlementMigrationMapping[]): void {
  const planIds = new Set<string>();
  const refs = new Set<string>();

  for (const mapping of mappings) {
    if (mapping.planId.trim().length === 0 || String(mapping.planVersionRef).trim().length === 0) {
      throw new EntitlementDefinitionProblem(
        "Entitlement migration mappings require non-empty plan IDs and plan version references.",
      );
    }
    if (planIds.has(mapping.planId) || refs.has(mapping.planVersionRef)) {
      throw new EntitlementDefinitionProblem(
        "Entitlement migration mappings must be one-to-one by plan ID and plan version reference.",
      );
    }
    if (String(mapping.planVersionRef).startsWith("legacy:")) {
      throw new EntitlementDefinitionProblem(
        "Entitlement migration mappings require published, non-legacy plan version references.",
      );
    }

    planIds.add(mapping.planId);
    refs.add(mapping.planVersionRef);
  }
}

async function runMigration(
  db: EntitlementMigrationClient,
  migrate: (tx: EntitlementMigrationClient) => Promise<void>,
): Promise<void> {
  if (db.transaction) {
    await db.transaction(migrate);
    return;
  }

  await migrate(db);
}

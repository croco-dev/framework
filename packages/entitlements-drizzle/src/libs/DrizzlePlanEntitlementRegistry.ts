import type { EntitlementRule } from "@croco/entitlements-core";
import {
  EntitlementDefinitionProblem,
  EntitlementPlanVersionMismatchProblem,
  EntitlementPlanVersionNotFoundProblem,
  getLegacyPlanId,
  PlanEntitlementRegistry,
} from "@croco/entitlements-core";
import { Token } from "@croco/framework-context";
import type { PlanVersionRef } from "@croco/billing-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { planEntitlements, planEntitlementSets } from "./schema";

type DrizzleEntitlementsClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

interface PlanEntitlementsRow {
  id: string;
  planId: string;
  planVersionRef: string | null;
  featureKey: string;
  type: string;
  value: number | null;
  meterId: string | null;
  meterBilling: string | null;
  quota: number | null;
  overagePolicy: string | null;
  createdAt: Date | null;
}

/**
 * Drizzle 권한 레지스트리에서 사용하는 DI 토큰입니다.
 */
export const DRIZZLE_TOKEN = new Token<DrizzleEntitlementsClient>("DRIZZLE_TOKEN");

/**
 * 권한 레지스트리에서 사용하는 Drizzle 클라이언트 타입입니다.
 */
export type { DrizzleEntitlementsClient };

/**
 * 플랜별 권한 규칙을 Drizzle 테이블에서 조회하는 구현체입니다.
 */
export class DrizzlePlanEntitlementRegistry extends PlanEntitlementRegistry {
  /**
   * Drizzle 클라이언트를 받아 권한 레지스트리를 초기화합니다.
   */
  constructor(private readonly db: DrizzleEntitlementsClient) {
    super();
  }

  /**
   * 플랜에 연결된 모든 권한 규칙을 반환합니다.
   */
  async getEntitlements(planId: string): Promise<EntitlementRule[]> {
    const rows = await this.db
      .select()
      .from(planEntitlements)
      .where(and(eq(planEntitlements.planId, planId), isNull(planEntitlements.planVersionRef)));

    const result = rows as PlanEntitlementsRow[];

    return result.map((row) => mapEntitlementRule(row, false));
  }

  /**
   * 플랜에서 특정 기능 키의 규칙을 조회합니다.
   */
  async findRule(planId: string, featureKey: string): Promise<EntitlementRule | null> {
    const entitlements = await this.getEntitlements(planId);
    return entitlements.find((rule) => rule.featureKey === featureKey) ?? null;
  }

  /**
   * 고정된 플랜 버전에 연결된 모든 권한 규칙을 반환합니다.
   */
  override async getEntitlementsByPlanVersion(
    ref: PlanVersionRef,
    expectedPlanId?: string,
  ): Promise<readonly EntitlementRule[]> {
    const legacyPlanId = getLegacyPlanId(ref);
    if (legacyPlanId !== null) {
      return this.getEntitlements(legacyPlanId);
    }

    const sets = await this.db
      .select({
        planVersionRef: planEntitlementSets.planVersionRef,
        planId: planEntitlementSets.planId,
      })
      .from(planEntitlementSets)
      .where(eq(planEntitlementSets.planVersionRef, ref));
    const set = sets[0];
    if (!set) {
      throw new EntitlementPlanVersionNotFoundProblem(ref);
    }
    if (expectedPlanId !== undefined && set.planId !== expectedPlanId) {
      throw new EntitlementPlanVersionMismatchProblem(ref, expectedPlanId, set.planId);
    }

    const rows = await this.db
      .select()
      .from(planEntitlements)
      .where(eq(planEntitlements.planVersionRef, ref));
    const result = rows as PlanEntitlementsRow[];

    const rules = result.map((row) => mapEntitlementRule(row, true));
    assertBillableOverageBindings(rules);
    return rules;
  }

  /**
   * 고정된 플랜 버전에서 특정 기능 키의 규칙을 조회합니다.
   */
  override async findRuleByPlanVersion(
    ref: PlanVersionRef,
    featureKey: string,
    expectedPlanId?: string,
  ): Promise<EntitlementRule | null> {
    const entitlements = await this.getEntitlementsByPlanVersion(ref, expectedPlanId);
    return entitlements.find((rule) => rule.featureKey === featureKey) ?? null;
  }
}

function assertBillableOverageBindings(rules: readonly EntitlementRule[]): void {
  for (const rule of rules) {
    if (
      rule.overagePolicy === "ALLOW_WITH_OVERAGE" &&
      (rule.meterId === undefined || rule.meterBilling !== "required")
    ) {
      throw new EntitlementDefinitionProblem(
        `Entitlement '${rule.featureKey}' allows billable overage without a billing-required meter.`,
      );
    }
  }
}

function mapEntitlementRule(row: PlanEntitlementsRow, versionBound: boolean): EntitlementRule {
  if (row.type !== "boolean" && row.type !== "metered" && row.type !== "static") {
    throw new EntitlementDefinitionProblem(
      `Persisted entitlement '${row.featureKey}' has unknown type '${row.type}'.`,
    );
  }
  const overagePolicy = normalizeOveragePolicy(row.overagePolicy);
  if (row.overagePolicy !== null && overagePolicy === undefined) {
    throw new EntitlementDefinitionProblem(
      `Persisted entitlement '${row.featureKey}' has unknown overage policy '${row.overagePolicy}'.`,
    );
  }
  if (versionBound && row.type === "metered" && row.quota === null) {
    throw new EntitlementDefinitionProblem(
      `Version-bound metered entitlement '${row.featureKey}' requires an inline quota.`,
    );
  }
  if (row.type === "static" && row.value === null) {
    throw new EntitlementDefinitionProblem(
      `Static entitlement '${row.featureKey}' requires a value.`,
    );
  }

  return {
    featureKey: row.featureKey,
    type: row.type,
    value: row.value ?? undefined,
    meterId: row.meterId ?? undefined,
    meterBilling:
      row.meterBilling === "local" || row.meterBilling === "required"
        ? row.meterBilling
        : undefined,
    quota: row.quota ?? undefined,
    overagePolicy,
  };
}

function normalizeOveragePolicy(
  policy: string | null,
): EntitlementRule["overagePolicy"] | undefined {
  switch (policy) {
    case "block":
    case "BLOCK":
      return "BLOCK";
    case "warn":
    case "WARN":
      return "WARN";
    case "allow":
    case "ALLOW_WITH_OVERAGE":
      return "ALLOW_WITH_OVERAGE";
    default:
      return undefined;
  }
}

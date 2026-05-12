import type { EntitlementRule } from "@croco/entitlements-core";
import { PlanEntitlementRegistry } from "@croco/entitlements-core";
import { Token } from "@croco/framework-context";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { planEntitlements } from "./schema";

type DrizzleEntitlementsClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

interface PlanEntitlementsRow {
  id: string;
  planId: string;
  featureKey: string;
  type: string;
  value: number | null;
  meterId: string | null;
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
      .where(eq(planEntitlements.planId, planId));

    const result = rows as PlanEntitlementsRow[];

    return result.map((row) => ({
      featureKey: row.featureKey,
      type: row.type as EntitlementRule["type"],
      value: row.value ?? undefined,
      meterId: row.meterId ?? undefined,
      quota: row.quota ?? undefined,
      overagePolicy: (row.overagePolicy as EntitlementRule["overagePolicy"]) ?? undefined,
    }));
  }

  /**
   * 플랜에서 특정 기능 키의 규칙을 조회합니다.
   */
  async findRule(planId: string, featureKey: string): Promise<EntitlementRule | null> {
    const entitlements = await this.getEntitlements(planId);
    return entitlements.find((rule) => rule.featureKey === featureKey) ?? null;
  }
}

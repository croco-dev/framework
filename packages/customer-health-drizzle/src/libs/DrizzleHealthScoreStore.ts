import type {
  HealthSignal,
  HealthTransitionEventIntent,
  TenantHealthScore,
  TrendPeriod,
} from "@croco/customer-health-core";
import { HealthScoreStore } from "@croco/customer-health-core";
import { Component, Inject, Token } from "@croco/framework-context";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { tenantHealthEventIntents, tenantHealthScores } from "./schema";
import { HealthTransitionSequenceMissingProblem } from "./problems/DrizzleHealthProblems";

/**
 * 건강 점수 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
 */
export type DrizzleHealthClient = NodePgDatabase<Record<string, never>>;

/**
 * 건강 점수 저장소용 Drizzle 클라이언트 주입 토큰입니다.
 */
export const DRIZZLE_TOKEN = new Token<DrizzleHealthClient>("DRIZZLE_TOKEN");

type TenantHealthScoreRow = {
  transitionSequence: bigint;
  tenantId: string;
  overallScore: number;
  status: "healthy" | "at_risk" | "critical";
  categoryScores: Record<string, number>;
  signals: StoredHealthSignal[];
  trend: "improving" | "stable" | "declining";
  previousScore: number | null;
  calculatedAt: Date;
};

type StoredHealthSignal = Omit<HealthSignal, "collectedAt"> & {
  collectedAt: Date | string;
};

/**
 * 건강 점수 이력을 Drizzle 테이블에 저장하는 구현체입니다.
 */
@Component()
export class DrizzleHealthScoreStore extends HealthScoreStore {
  /**
   * Drizzle 클라이언트를 받아 저장소를 초기화합니다.
   */
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleHealthClient) {
    super();
  }

  /**
   * 계산된 건강 점수를 저장합니다.
   */
  async saveTransition(
    score: TenantHealthScore,
    previous: TenantHealthScore | null,
    eventIntents: readonly HealthTransitionEventIntent[],
  ): Promise<
    | { readonly committed: true }
    | { readonly committed: false; readonly latest: TenantHealthScore | null }
  > {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${score.tenantId}, 0))`);
      const rows = await tx
        .select()
        .from(tenantHealthScores)
        .where(eq(tenantHealthScores.tenantId, score.tenantId))
        .orderBy(desc(tenantHealthScores.transitionSequence))
        .limit(1);
      const latestRow = rows[0] as TenantHealthScoreRow | undefined;
      const latest = latestRow ? this.mapToTenantHealthScore(latestRow) : null;
      if (!matchesPrevious(latest, previous)) {
        return { committed: false, latest };
      }

      const insertedRows = await tx
        .insert(tenantHealthScores)
        .values(score)
        .returning({ transitionSequence: tenantHealthScores.transitionSequence });
      const inserted = insertedRows[0];
      if (inserted) score.transitionVersion = String(inserted.transitionSequence);
      if (eventIntents.length > 0) {
        if (!inserted) throw new HealthTransitionSequenceMissingProblem();
        await tx.insert(tenantHealthEventIntents).values(
          eventIntents.map((intent, intentOrder) => ({
            eventId: intent.eventId,
            tenantId: intent.tenantId,
            transitionSequence: inserted.transitionSequence,
            intentOrder,
            occurredAt: intent.occurredAt,
            data: intent.data,
          })),
        );
      }
      return { committed: true };
    });
  }

  async listPendingEventIntents(
    tenantId: string,
    limit = 100,
  ): Promise<readonly HealthTransitionEventIntent[]> {
    if (!Number.isInteger(limit) || limit <= 0) return [];
    const rows = await this.db
      .select()
      .from(tenantHealthEventIntents)
      .where(
        and(
          eq(tenantHealthEventIntents.tenantId, tenantId),
          isNull(tenantHealthEventIntents.publishedAt),
        ),
      )
      .orderBy(
        asc(tenantHealthEventIntents.transitionSequence),
        asc(tenantHealthEventIntents.intentOrder),
      )
      .limit(limit);
    return rows.map((row) => ({
      eventId: row.eventId,
      tenantId: row.tenantId,
      occurredAt: row.occurredAt,
      data: row.data,
    }));
  }

  async markEventIntentPublished(eventId: string): Promise<void> {
    await this.db
      .update(tenantHealthEventIntents)
      .set({ publishedAt: new Date() })
      .where(
        and(
          eq(tenantHealthEventIntents.eventId, eventId),
          isNull(tenantHealthEventIntents.publishedAt),
        ),
      );
  }

  /**
   * 테넌트의 최신 건강 점수를 조회합니다.
   */
  async findLatest(tenantId: string): Promise<TenantHealthScore | null> {
    const result = await this.db
      .select()
      .from(tenantHealthScores)
      .where(eq(tenantHealthScores.tenantId, tenantId))
      .orderBy(desc(tenantHealthScores.transitionSequence))
      .limit(1);
    const row = result[0] as TenantHealthScoreRow | undefined;
    return row ? this.mapToTenantHealthScore(row) : null;
  }

  /**
   * 테넌트의 건강 점수 이력을 최신순으로 조회합니다.
   */
  async findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]> {
    const results = await this.db
      .select()
      .from(tenantHealthScores)
      .where(eq(tenantHealthScores.tenantId, tenantId))
      .orderBy(desc(tenantHealthScores.transitionSequence))
      .limit(limit);
    return (results as TenantHealthScoreRow[]).map((row) => this.mapToTenantHealthScore(row));
  }

  /**
   * 기간 범위에 포함되는 건강 점수 이력을 조회합니다.
   */
  async findHistoryByPeriod(
    tenantId: string,
    _period: TrendPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<TenantHealthScore[]> {
    const results = await this.db
      .select()
      .from(tenantHealthScores)
      .where(
        and(
          eq(tenantHealthScores.tenantId, tenantId),
          gte(tenantHealthScores.calculatedAt, startDate),
          lte(tenantHealthScores.calculatedAt, endDate),
        ),
      )
      .orderBy(desc(tenantHealthScores.calculatedAt));
    return (results as TenantHealthScoreRow[]).map((row) => this.mapToTenantHealthScore(row));
  }

  private mapToTenantHealthScore(row: TenantHealthScoreRow): TenantHealthScore {
    return {
      tenantId: row.tenantId,
      transitionVersion: String(row.transitionSequence),
      overallScore: row.overallScore,
      status: row.status,
      categoryScores: structuredClone(row.categoryScores) as TenantHealthScore["categoryScores"],
      signals: row.signals.map((signal) => ({
        category: signal.category,
        name: signal.name,
        value: signal.value,
        weight: signal.weight,
        rawValue: structuredClone(signal.rawValue),
        collectedAt: cloneStoredDate(signal.collectedAt),
      })),
      trend: row.trend,
      previousScore: row.previousScore ?? undefined,
      calculatedAt: new Date(row.calculatedAt.getTime()),
    };
  }
}

function cloneStoredDate(value: Date | string): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function matchesPrevious(
  latest: TenantHealthScore | null,
  expected: TenantHealthScore | null,
): boolean {
  if (!latest || !expected) return latest === expected;
  if (latest.transitionVersion || expected.transitionVersion) {
    return latest.transitionVersion === expected.transitionVersion;
  }
  return (
    latest.tenantId === expected.tenantId &&
    latest.calculatedAt.getTime() === expected.calculatedAt.getTime() &&
    latest.overallScore === expected.overallScore &&
    latest.status === expected.status
  );
}

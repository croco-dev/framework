import type { MetricsSnapshot, MRRMovement, Period, RetentionMetrics } from "../../types";
import { MetricsRepository } from "../interfaces/MetricsRepository";
import { RetentionCalculator } from "../RetentionCalculator";

/**
 * PostgreSQL 클라이언트 인터페이스 (pg 또는 호환 라이브러리)
 *
 * @description
 * pg.Pool, pg.Client, 또는 Prisma Client 등과 호환되는 최소 인터페이스
 */
export interface PostgresClient {
  /**
   * 쿼리 실행
   *
   * @param sql - SQL 쿼리 문자열 (parameterized query: $1, $2, ...)
   * @param params - 쿼리 파라미터
   * @returns 쿼리 결과 rows
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * TimescaleDB 기반 MetricsRepository 구현체
 *
 * @description
 * - TimescaleDB Hypertable에 MRR 변동 이력과 스냅샷 저장
 * - recordSnapshot은 upsert (ON CONFLICT UPDATE) 사용
 * - getRetentionMetrics은 스냅샷과 변동 이력을 집계하여 계산
 *
 * **참고**: 실제 구현 시 쿼리 로직을 완성해야 합니다.
 * 이 파일은 인터페이스와 스켈레톤만 제공합니다.
 */
export class TimescaleMetricsStore extends MetricsRepository {
  private static readonly MRR_MOVEMENTS_TABLE = "mrr_movements";
  private static readonly SNAPSHOTS_TABLE = "metrics_snapshots";

  private readonly retentionCalculator = new RetentionCalculator();

  constructor(private readonly db: PostgresClient) {
    super();
  }

  async recordMRRMovement(
    tenantId: string,
    movement: MRRMovement,
    timestamp: Date,
    eventKey?: string,
    dedupeEventKeys: readonly string[] = [],
  ): Promise<void> {
    const hasDedupeAliases = eventKey !== undefined && dedupeEventKeys.length > 0;
    const sql = eventKey
      ? hasDedupeAliases
        ? `
      INSERT INTO ${TimescaleMetricsStore.MRR_MOVEMENTS_TABLE} (
        tenant_id, event_key, timestamp,
        new_mrr_amount, new_mrr_currency,
        expansion_mrr_amount, expansion_mrr_currency,
        contraction_mrr_amount, contraction_mrr_currency,
        churned_mrr_amount, churned_mrr_currency,
        reactivation_mrr_amount, reactivation_mrr_currency,
        net_mrr_amount, net_mrr_currency
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      WHERE NOT EXISTS (
        SELECT 1 FROM ${TimescaleMetricsStore.MRR_MOVEMENTS_TABLE}
        WHERE tenant_id = $1 AND event_key = ANY($16::text[])
      )
      ON CONFLICT (tenant_id, event_key) DO NOTHING
    `
        : `
      INSERT INTO ${TimescaleMetricsStore.MRR_MOVEMENTS_TABLE} (
        tenant_id, event_key, timestamp,
        new_mrr_amount, new_mrr_currency,
        expansion_mrr_amount, expansion_mrr_currency,
        contraction_mrr_amount, contraction_mrr_currency,
        churned_mrr_amount, churned_mrr_currency,
        reactivation_mrr_amount, reactivation_mrr_currency,
        net_mrr_amount, net_mrr_currency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (tenant_id, event_key) DO NOTHING
    `
      : `
      INSERT INTO ${TimescaleMetricsStore.MRR_MOVEMENTS_TABLE} (
        tenant_id, timestamp,
        new_mrr_amount, new_mrr_currency,
        expansion_mrr_amount, expansion_mrr_currency,
        contraction_mrr_amount, contraction_mrr_currency,
        churned_mrr_amount, churned_mrr_currency,
        reactivation_mrr_amount, reactivation_mrr_currency,
        net_mrr_amount, net_mrr_currency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    const movementParams = [
      movement.new.amount,
      movement.new.currency,
      movement.expansion.amount,
      movement.expansion.currency,
      movement.contraction.amount,
      movement.contraction.currency,
      movement.churned.amount,
      movement.churned.currency,
      movement.reactivation.amount,
      movement.reactivation.currency,
      movement.net.amount,
      movement.net.currency,
    ];
    const params = eventKey
      ? [
          tenantId,
          eventKey,
          timestamp,
          ...movementParams,
          ...(hasDedupeAliases ? [[eventKey, ...dedupeEventKeys]] : []),
        ]
      : [tenantId, timestamp, ...movementParams];

    await this.db.query(sql, params);
  }

  async recordSnapshot(tenantId: string, snapshot: MetricsSnapshot, date: Date): Promise<void> {
    const sql = `
      INSERT INTO ${TimescaleMetricsStore.SNAPSHOTS_TABLE} (
        tenant_id, snapshot_date, total_mrr_amount, total_mrr_currency, active_customers
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, snapshot_date)
      DO UPDATE SET
        total_mrr_amount = EXCLUDED.total_mrr_amount,
        total_mrr_currency = EXCLUDED.total_mrr_currency,
        active_customers = EXCLUDED.active_customers,
        created_at = NOW()
    `;

    const params = [
      tenantId,
      date,
      snapshot.totalMRR.amount,
      snapshot.totalMRR.currency,
      snapshot.activeCustomers,
    ];

    await this.db.query(sql, params);
  }

  async getSnapshot(tenantId: string, date: Date): Promise<MetricsSnapshot | null> {
    const sql = `
      SELECT
        snapshot_date as "date",
        total_mrr_amount,
        total_mrr_currency,
        active_customers as "activeCustomers"
      FROM ${TimescaleMetricsStore.SNAPSHOTS_TABLE}
      WHERE tenant_id = $1 AND snapshot_date = $2
    `;

    const result = await this.db.query<{
      date: Date;
      total_mrr_amount: number;
      total_mrr_currency: string;
      activeCustomers: number;
    }>(sql, [tenantId, date]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      date: row.date,
      totalMRR: {
        amount: row.total_mrr_amount,
        currency: row.total_mrr_currency,
      },
      activeCustomers: row.activeCustomers,
    };
  }

  async getMRRHistory(tenantId: string, period: Period): Promise<MRRMovement[]> {
    const sql = `
      SELECT
        new_mrr_amount,
        new_mrr_currency,
        expansion_mrr_amount,
        expansion_mrr_currency,
        contraction_mrr_amount,
        contraction_mrr_currency,
        churned_mrr_amount,
        churned_mrr_currency,
        reactivation_mrr_amount,
        reactivation_mrr_currency,
        net_mrr_amount,
        net_mrr_currency
      FROM ${TimescaleMetricsStore.MRR_MOVEMENTS_TABLE}
      WHERE tenant_id = $1
        AND timestamp >= $2
        AND timestamp < $3
      ORDER BY timestamp ASC
    `;

    const result = await this.db.query<{
      new_mrr_amount: number;
      new_mrr_currency: string;
      expansion_mrr_amount: number;
      expansion_mrr_currency: string;
      contraction_mrr_amount: number;
      contraction_mrr_currency: string;
      churned_mrr_amount: number;
      churned_mrr_currency: string;
      reactivation_mrr_amount: number;
      reactivation_mrr_currency: string;
      net_mrr_amount: number;
      net_mrr_currency: string;
    }>(sql, [tenantId, period.from, period.to]);

    return result.rows.map(
      (row) =>
        ({
          new: { amount: row.new_mrr_amount, currency: row.new_mrr_currency },
          expansion: { amount: row.expansion_mrr_amount, currency: row.expansion_mrr_currency },
          contraction: {
            amount: row.contraction_mrr_amount,
            currency: row.contraction_mrr_currency,
          },
          churned: { amount: row.churned_mrr_amount, currency: row.churned_mrr_currency },
          reactivation: {
            amount: row.reactivation_mrr_amount,
            currency: row.reactivation_mrr_currency,
          },
          net: { amount: row.net_mrr_amount, currency: row.net_mrr_currency },
        }) as MRRMovement,
    );
  }

  async getRetentionMetrics(tenantId: string, period: Period): Promise<RetentionMetrics> {
    const [startingSnapshot, endingSnapshot, movements] = await Promise.all([
      this.getLatestSnapshotOnOrBefore(tenantId, period.from),
      this.getLatestSnapshotOnOrBefore(tenantId, new Date(period.to.getTime() - 1)),
      this.getMRRHistory(tenantId, period),
    ]);

    const movement = this.aggregateMovements(
      movements,
      startingSnapshot?.totalMRR.currency ?? "USD",
    );
    const startingMRR = startingSnapshot?.totalMRR.amount ?? 0;

    const [revenueChurn, grr, nrr] = await Promise.all([
      this.retentionCalculator.calculateChurn(startingMRR, movement, "revenue"),
      this.retentionCalculator.calculateGRR(startingMRR, movement),
      this.retentionCalculator.calculateNRR(startingMRR, movement),
    ]);

    return {
      logoChurn: this.calculateLogoChurn(startingSnapshot, endingSnapshot),
      revenueChurn: revenueChurn ?? 0,
      grr: grr ?? 100,
      nrr: nrr ?? 100,
    };
  }

  private async getLatestSnapshotOnOrBefore(
    tenantId: string,
    date: Date,
  ): Promise<MetricsSnapshot | null> {
    const sql = `
      SELECT
        snapshot_date as "date",
        total_mrr_amount,
        total_mrr_currency,
        active_customers as "activeCustomers"
      FROM ${TimescaleMetricsStore.SNAPSHOTS_TABLE}
      WHERE tenant_id = $1 AND snapshot_date <= $2
      ORDER BY snapshot_date DESC
      LIMIT 1
    `;

    const result = await this.db.query<{
      date: Date;
      total_mrr_amount: number;
      total_mrr_currency: string;
      activeCustomers: number;
    }>(sql, [tenantId, date]);

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      date: row.date,
      totalMRR: {
        amount: row.total_mrr_amount,
        currency: row.total_mrr_currency,
      },
      activeCustomers: row.activeCustomers,
    };
  }

  private aggregateMovements(movements: MRRMovement[], currency: string): MRRMovement {
    const aggregate = (): { amount: number; currency: string } => ({ amount: 0, currency });

    const totals: MRRMovement = {
      new: aggregate(),
      expansion: aggregate(),
      contraction: aggregate(),
      churned: aggregate(),
      reactivation: aggregate(),
      net: aggregate(),
    };

    for (const movement of movements) {
      totals.new.amount += movement.new.amount;
      totals.expansion.amount += movement.expansion.amount;
      totals.contraction.amount += movement.contraction.amount;
      totals.churned.amount += movement.churned.amount;
      totals.reactivation.amount += movement.reactivation.amount;
      totals.net.amount += movement.net.amount;
    }

    return totals;
  }

  private calculateLogoChurn(
    startingSnapshot: MetricsSnapshot | null,
    endingSnapshot: MetricsSnapshot | null,
  ): number {
    if (!startingSnapshot || !endingSnapshot || startingSnapshot.activeCustomers === 0) {
      return 0;
    }

    const churnedCustomers = Math.max(
      startingSnapshot.activeCustomers - endingSnapshot.activeCustomers,
      0,
    );

    return (churnedCustomers / startingSnapshot.activeCustomers) * 100;
  }
}

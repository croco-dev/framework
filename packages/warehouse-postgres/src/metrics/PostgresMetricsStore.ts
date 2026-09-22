import { MetricsRepository, RetentionCalculator } from "@croco/metrics-core";
import { ProblemFactory } from "@croco/problems-core";

import type { MetricsSnapshot, MRRMovement, Period, RetentionMetrics } from "@croco/metrics-core";
import type { MetricsPostgresClient } from "./MetricsPostgresClient";

type NumericColumn = number | string;

type SnapshotRow = {
  readonly activeCustomers: NumericColumn;
  readonly date: Date | string;
  readonly total_mrr_amount: NumericColumn;
  readonly total_mrr_currency: string;
};

type MovementRow = {
  readonly churned_mrr_amount: NumericColumn;
  readonly churned_mrr_currency: string;
  readonly contraction_mrr_amount: NumericColumn;
  readonly contraction_mrr_currency: string;
  readonly expansion_mrr_amount: NumericColumn;
  readonly expansion_mrr_currency: string;
  readonly net_mrr_amount: NumericColumn;
  readonly net_mrr_currency: string;
  readonly new_mrr_amount: NumericColumn;
  readonly new_mrr_currency: string;
  readonly reactivation_mrr_amount: NumericColumn;
  readonly reactivation_mrr_currency: string;
};

/** PostgreSQL implementation of the metrics repository contract. */
export class PostgresMetricsStore extends MetricsRepository {
  private static readonly MRR_MOVEMENTS_TABLE = "mrr_movements";
  private static readonly MRR_MOVEMENT_EVENT_KEYS_TABLE = "mrr_movement_event_keys";
  private static readonly SNAPSHOTS_TABLE = "metrics_snapshots";

  private readonly retentionCalculator = new RetentionCalculator();

  constructor(private readonly db: MetricsPostgresClient) {
    super();
  }

  async recordMRRMovement(
    tenantId: string,
    movement: MRRMovement,
    timestamp: Date,
    eventKey?: string,
    dedupeEventKeys: readonly string[] = [],
  ): Promise<void> {
    const sql = eventKey
      ? `
      WITH candidate_event_keys AS MATERIALIZED (
        SELECT DISTINCT candidate.event_key
        FROM unnest($16::text[]) AS candidate(event_key)
      ), claimed_event_keys AS (
        INSERT INTO ${PostgresMetricsStore.MRR_MOVEMENT_EVENT_KEYS_TABLE} (tenant_id, event_key)
        SELECT $1, candidate.event_key
        FROM candidate_event_keys AS candidate
        ORDER BY candidate.event_key
        ON CONFLICT (tenant_id, event_key) DO NOTHING
        RETURNING event_key
      ), claim AS MATERIALIZED (
        SELECT
          (SELECT COUNT(*) FROM candidate_event_keys) > 0
          AND (SELECT COUNT(*) FROM claimed_event_keys) = (SELECT COUNT(*) FROM candidate_event_keys)
          AS won
      )
      INSERT INTO ${PostgresMetricsStore.MRR_MOVEMENTS_TABLE} (
        tenant_id, event_key, timestamp,
        new_mrr_amount, new_mrr_currency,
        expansion_mrr_amount, expansion_mrr_currency,
        contraction_mrr_amount, contraction_mrr_currency,
        churned_mrr_amount, churned_mrr_currency,
        reactivation_mrr_amount, reactivation_mrr_currency,
        net_mrr_amount, net_mrr_currency
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      FROM claim
      WHERE claim.won
    `
      : `
      INSERT INTO ${PostgresMetricsStore.MRR_MOVEMENTS_TABLE} (
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
      ? [tenantId, eventKey, timestamp, ...movementParams, [eventKey, ...dedupeEventKeys]]
      : [tenantId, timestamp, ...movementParams];

    await this.db.query(sql, params);
  }

  async recordSnapshot(tenantId: string, snapshot: MetricsSnapshot, date: Date): Promise<void> {
    const sql = `
      INSERT INTO ${PostgresMetricsStore.SNAPSHOTS_TABLE} (
        tenant_id, snapshot_date, total_mrr_amount, total_mrr_currency, active_customers
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, snapshot_date)
      DO UPDATE SET
        total_mrr_amount = EXCLUDED.total_mrr_amount,
        total_mrr_currency = EXCLUDED.total_mrr_currency,
        active_customers = EXCLUDED.active_customers,
        created_at = NOW()
    `;

    await this.db.query(sql, [
      tenantId,
      date,
      snapshot.totalMRR.amount,
      snapshot.totalMRR.currency,
      snapshot.activeCustomers,
    ]);
  }

  async getSnapshot(tenantId: string, date: Date): Promise<MetricsSnapshot | null> {
    const result = await this.db.query<SnapshotRow>(
      `
      SELECT
        snapshot_date AS "date",
        total_mrr_amount,
        total_mrr_currency,
        active_customers AS "activeCustomers"
      FROM ${PostgresMetricsStore.SNAPSHOTS_TABLE}
      WHERE tenant_id = $1 AND snapshot_date = $2
    `,
      [tenantId, date],
    );

    const row = result.rows[0];
    return row ? decodeSnapshot(row) : null;
  }

  async getMRRHistory(tenantId: string, period: Period): Promise<MRRMovement[]> {
    const result = await this.db.query<MovementRow>(
      `
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
      FROM ${PostgresMetricsStore.MRR_MOVEMENTS_TABLE}
      WHERE tenant_id = $1
        AND timestamp >= $2
        AND timestamp < $3
      ORDER BY timestamp ASC
    `,
      [tenantId, period.from, period.to],
    );

    return result.rows.map(decodeMovement);
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
    const result = await this.db.query<SnapshotRow>(
      `
      SELECT
        snapshot_date AS "date",
        total_mrr_amount,
        total_mrr_currency,
        active_customers AS "activeCustomers"
      FROM ${PostgresMetricsStore.SNAPSHOTS_TABLE}
      WHERE tenant_id = $1 AND snapshot_date <= $2
      ORDER BY snapshot_date DESC
      LIMIT 1
    `,
      [tenantId, date],
    );

    const row = result.rows[0];
    return row ? decodeSnapshot(row) : null;
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

function decodeSnapshot(row: SnapshotRow): MetricsSnapshot {
  return {
    date: decodeDate(row.date, "snapshot_date"),
    totalMRR: {
      amount: decodeSafeInteger(row.total_mrr_amount, "total_mrr_amount"),
      currency: row.total_mrr_currency,
    },
    activeCustomers: decodeSafeInteger(row.activeCustomers, "active_customers"),
  };
}

function decodeMovement(row: MovementRow): MRRMovement {
  return {
    new: {
      amount: decodeSafeInteger(row.new_mrr_amount, "new_mrr_amount"),
      currency: row.new_mrr_currency,
    },
    expansion: {
      amount: decodeSafeInteger(row.expansion_mrr_amount, "expansion_mrr_amount"),
      currency: row.expansion_mrr_currency,
    },
    contraction: {
      amount: decodeSafeInteger(row.contraction_mrr_amount, "contraction_mrr_amount"),
      currency: row.contraction_mrr_currency,
    },
    churned: {
      amount: decodeSafeInteger(row.churned_mrr_amount, "churned_mrr_amount"),
      currency: row.churned_mrr_currency,
    },
    reactivation: {
      amount: decodeSafeInteger(row.reactivation_mrr_amount, "reactivation_mrr_amount"),
      currency: row.reactivation_mrr_currency,
    },
    net: {
      amount: decodeSafeInteger(row.net_mrr_amount, "net_mrr_amount"),
      currency: row.net_mrr_currency,
    },
  };
}

function decodeSafeInteger(value: NumericColumn, column: string): number {
  const decoded =
    typeof value === "number" ? value : /^[+-]?\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(decoded)) {
    invalidMetricsRow(column, "a safe integer");
  }
  return decoded;
}

function decodeDate(value: Date | string, column: string): Date {
  const decoded =
    value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(decoded.getTime())) {
    invalidMetricsRow(column, "a valid date");
  }
  return decoded;
}

function invalidMetricsRow(column: string, expected: string): never {
  throw ProblemFactory.internalServerError(
    "warehouse-postgres/metrics-row-invalid",
    `PostgreSQL metrics column '${column}' must contain ${expected}.`,
  );
}

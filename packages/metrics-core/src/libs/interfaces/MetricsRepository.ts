import type { MetricsSnapshot, MRRMovement, Period, RetentionMetrics } from "../../types";

/**
 * Repository abstract class for storing and querying metrics data.
 *
 * @description
 * 구현체: TimescaleMetricsStore (TimescaleDB) 또는 사용자 커스텀
 * 모든 메서드는 tenant 격리를 보장해야 함
 *
 * **TimescaleDB Schema (Hypertable)**:
 * ```sql
 * -- TimescaleDB 확장 활성화
 * CREATE EXTENSION IF NOT EXISTS timescaledb;
 *
 * -- MRR 변동 이력 테이블
 * CREATE TABLE mrr_movements (
 *   id BIGSERIAL NOT NULL,
 *   tenant_id VARCHAR(255) NOT NULL,
 *   event_key VARCHAR(255),
 *   timestamp TIMESTAMPTZ NOT NULL,
 *   new_mrr_amount BIGINT NOT NULL,
 *   new_mrr_currency VARCHAR(3) NOT NULL,
 *   expansion_mrr_amount BIGINT NOT NULL,
 *   expansion_mrr_currency VARCHAR(3) NOT NULL,
 *   contraction_mrr_amount BIGINT NOT NULL,
 *   contraction_mrr_currency VARCHAR(3) NOT NULL,
 *   churned_mrr_amount BIGINT NOT NULL,
 *   churned_mrr_currency VARCHAR(3) NOT NULL,
 *   reactivation_mrr_amount BIGINT NOT NULL,
 *   reactivation_mrr_currency VARCHAR(3) NOT NULL,
 *   net_mrr_amount BIGINT NOT NULL,
 *   net_mrr_currency VARCHAR(3) NOT NULL,
 *   PRIMARY KEY (id, timestamp)
 * );
 *
 * -- 시간 기반 파티셔닝을 위한 Hypertable 변환
 * SELECT create_hypertable('mrr_movements', 'timestamp', chunk_time_interval => INTERVAL '1 month');
 *
 * -- 인덱스 생성
 * CREATE INDEX idx_mrr_movements_tenant_timestamp ON mrr_movements (tenant_id, timestamp DESC);
 *
 * -- Hypertable 밖에서 tenant 전역 이벤트 멱등성 키 선점
 * CREATE TABLE mrr_movement_event_keys (
 *   tenant_id VARCHAR(255) NOT NULL,
 *   event_key VARCHAR(255) NOT NULL,
 *   claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   PRIMARY KEY (tenant_id, event_key)
 * );
 *
 * -- 메트릭 스냅샷 테이블
 * CREATE TABLE metrics_snapshots (
 *   id BIGSERIAL NOT NULL,
 *   tenant_id VARCHAR(255) NOT NULL,
 *   snapshot_date DATE NOT NULL,
 *   total_mrr_amount BIGINT NOT NULL,
 *   total_mrr_currency VARCHAR(3) NOT NULL,
 *   active_customers INTEGER NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   PRIMARY KEY (id, snapshot_date),
 *   UNIQUE (tenant_id, snapshot_date)
 * );
 *
 * -- 시간 기반 파티셔닝을 위한 Hypertable 변환
 * SELECT create_hypertable('metrics_snapshots', 'snapshot_date', chunk_time_interval => INTERVAL '1 month');
 *
 * -- 인덱스 생성
 * CREATE INDEX idx_snapshots_tenant_date ON metrics_snapshots (tenant_id, snapshot_date DESC);
 * ```
 *
 * Migration requires a writer pause: stop every legacy and current metrics writer before the final
 * reconciliation, keep them stopped while the schema transaction runs, deploy the new writers, and
 * only then resume traffic. For relational installations, run the following while writers remain
 * paused:
 * ```sql
 * BEGIN;
 * LOCK TABLE mrr_movements IN ACCESS EXCLUSIVE MODE;
 * LOCK TABLE metrics_snapshots IN ACCESS EXCLUSIVE MODE;
 * CREATE TABLE IF NOT EXISTS mrr_movement_event_keys (
 *   tenant_id VARCHAR(255) NOT NULL,
 *   event_key VARCHAR(255) NOT NULL,
 *   claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   PRIMARY KEY (tenant_id, event_key)
 * );
 * INSERT INTO mrr_movement_event_keys (tenant_id, event_key)
 * SELECT tenant_id, event_key FROM mrr_movements WHERE event_key IS NOT NULL
 * ON CONFLICT (tenant_id, event_key) DO NOTHING;
 * DROP INDEX IF EXISTS uq_mrr_movements_tenant_event_key;
 * ALTER TABLE mrr_movements DROP CONSTRAINT IF EXISTS mrr_movements_pkey;
 * ALTER TABLE mrr_movements ADD PRIMARY KEY (id, timestamp);
 * ALTER TABLE metrics_snapshots DROP CONSTRAINT IF EXISTS metrics_snapshots_pkey;
 * ALTER TABLE metrics_snapshots ADD PRIMARY KEY (id, snapshot_date);
 * COMMIT;
 * SELECT create_hypertable('mrr_movements', 'timestamp', migrate_data => TRUE);
 * SELECT create_hypertable('metrics_snapshots', 'snapshot_date', migrate_data => TRUE);
 * ```
 * Existing hypertables use the same writer pause, lock, and idempotent final reconciliation, but keep
 * their existing time-inclusive primary key. Drop obsolete time-inclusive event-key uniqueness only
 * after reconciliation commits. Never resume mixed-version traffic between the final backfill and
 * deployment: a legacy write in that window would not own a companion claim and could be duplicated.
 */
export abstract class MetricsRepository {
  /**
   * MRR 변동 이력 기록
   *
   * @param tenantId - 테넌트 ID
   * @param movement - MRR 변동 데이터
   * @param timestamp - 변동 발생 시각
   * @param eventKey - 이벤트 기반 멱등성 키 (선택)
   * @param dedupeEventKeys - 이전 버전이나 외부 시스템에서 이미 저장했을 수 있는 호환 멱등성 키
   */
  abstract recordMRRMovement(
    tenantId: string,
    movement: MRRMovement,
    timestamp: Date,
    eventKey?: string,
    dedupeEventKeys?: readonly string[],
  ): Promise<void>;

  /**
   * 메트릭 스냅샷 기록 (Upsert)
   *
   * @param tenantId - 테넌트 ID
   * @param snapshot - 스냅샷 데이터
   * @param date - 스냅샷 날짜
   */
  abstract recordSnapshot(tenantId: string, snapshot: MetricsSnapshot, date: Date): Promise<void>;

  /**
   * 특정 날짜의 메트릭 스냅샷 조회
   *
   * @param tenantId - 테넌트 ID
   * @param date - 조회할 날짜
   * @returns 스냅샷 데이터, 없으면 null
   */
  abstract getSnapshot(tenantId: string, date: Date): Promise<MetricsSnapshot | null>;

  /**
   * MRR 변동 이력 조회
   *
   * @param tenantId - 테넌트 ID
   * @param period - 조회 기간
   * @returns MRR 변동 데이터 배열
   */
  abstract getMRRHistory(tenantId: string, period: Period): Promise<MRRMovement[]>;

  /**
   * 리텐션 메트릭 계산
   *
   * @param tenantId - 테넌트 ID
   * @param period - 계산 기간
   * @returns 리텐션 메트릭 (GRR, NRR, Churn Rate 등)
   */
  abstract getRetentionMetrics(tenantId: string, period: Period): Promise<RetentionMetrics>;
}

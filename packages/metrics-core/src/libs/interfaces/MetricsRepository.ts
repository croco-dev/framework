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
 *   id BIGSERIAL PRIMARY KEY,
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
 *   net_mrr_currency VARCHAR(3) NOT NULL
 * );
 *
 * -- 시간 기반 파티셔닝을 위한 Hypertable 변환
 * SELECT create_hypertable('mrr_movements', 'timestamp', chunk_time_interval => INTERVAL '1 month');
 *
 * -- 인덱스 생성
 * CREATE INDEX idx_mrr_movements_tenant_timestamp ON mrr_movements (tenant_id, timestamp DESC);
 * CREATE UNIQUE INDEX uq_mrr_movements_tenant_event_key
 *   ON mrr_movements (tenant_id, event_key)
 *   WHERE event_key IS NOT NULL;
 *
 * -- 메트릭 스냅샷 테이블
 * CREATE TABLE metrics_snapshots (
 *   id BIGSERIAL PRIMARY KEY,
 *   tenant_id VARCHAR(255) NOT NULL,
 *   snapshot_date DATE NOT NULL,
 *   total_mrr_amount BIGINT NOT NULL,
 *   total_mrr_currency VARCHAR(3) NOT NULL,
 *   active_customers INTEGER NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   UNIQUE (tenant_id, snapshot_date)
 * );
 *
 * -- 시간 기반 파티셔닝을 위한 Hypertable 변환
 * SELECT create_hypertable('metrics_snapshots', 'snapshot_date', chunk_time_interval => INTERVAL '1 month');
 *
 * -- 인덱스 생성
 * CREATE INDEX idx_snapshots_tenant_date ON metrics_snapshots (tenant_id, snapshot_date DESC);
 * ```
 */
export abstract class MetricsRepository {
  /**
   * MRR 변동 이력 기록
   *
   * @param tenantId - 테넌트 ID
   * @param movement - MRR 변동 데이터
   * @param timestamp - 변동 발생 시각
   * @param eventKey - 이벤트 기반 멱등성 키 (선택)
   */
  abstract recordMRRMovement(
    tenantId: string,
    movement: MRRMovement,
    timestamp: Date,
    eventKey?: string,
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

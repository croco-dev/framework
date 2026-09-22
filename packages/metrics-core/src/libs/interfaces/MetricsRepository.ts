import type { MetricsSnapshot, MRRMovement, Period, RetentionMetrics } from "../../types";

/**
 * Repository abstract class for storing and querying metrics data.
 *
 * @description
 * 모든 구현체는 tenant 격리와 멱등적 movement 기록을 보장해야 합니다. 구체적인
 * database client, schema, migration, SQL은 provider package가 소유합니다.
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

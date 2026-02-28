// Types

/**
 * 운영 capacity 계산에 사용하는 설정 타입들입니다.
 */
export type {
  RevenueCCConfig,
  SimulationConfig,
  UserCCConfig,
} from './libs/CarryingCapacityCalculator';

/**
 * 사용자/매출 기준 운영 capacity를 계산하는 계산기입니다.
 */
export { CarryingCapacityCalculator } from './libs/CarryingCapacityCalculator';

/**
 * Quick Ratio와 성장 지표를 계산하는 계산기입니다.
 */
export { GrowthCalculator } from './libs/GrowthCalculator';

/**
 * 결제 이벤트를 수신해 메트릭 갱신 흐름으로 연결하는 핸들러입니다.
 */
export { BillingEventHandler } from './libs/handlers/BillingEventHandler';

/**
 * 활성 사용자 수 조회를 위한 데이터 소스 계약입니다.
 */
export type { ActiveUserProvider } from './libs/interfaces/ActiveUserProvider';
// Interfaces

/**
 * 메트릭 스토어 구현이 따라야 하는 저장/조회 계약입니다.
 */
export type { MetricsRepository } from './libs/interfaces/MetricsRepository';

/**
 * LTV 계산에 사용하는 입력 설정 타입입니다.
 */
export type { LtvConfig } from './libs/LtvCalculator';

/**
 * 고객 생애 가치(LTV)와 ARPA를 계산하는 계산기입니다.
 */
export { LtvCalculator } from './libs/LtvCalculator';
// Services

/**
 * 메트릭 계산 기능을 단일 API로 제공하는 파사드 서비스입니다.
 */
export { MetricsEngine } from './libs/MetricsEngine';
// Calculators

/**
 * 구독 집합으로부터 MRR을 계산하는 계산기입니다.
 */
export { MrrCalculator } from './libs/MrrCalculator';

/**
 * 운영 capacity 계산 과정에서 발생하는 Problem 하위 타입들입니다.
 */
export { CarryingCapacitySimulationProblem, LogoChurnDataRequiredProblem } from './libs/problems/MetricsProblems';

/**
 * churn, GRR, NRR 등 리텐션 지표를 계산하는 계산기입니다.
 */
export { RetentionCalculator } from './libs/RetentionCalculator';

/**
 * 메트릭 스냅샷 캡처에 사용하는 입력/설정 타입입니다.
 */
export type { SnapshotInput, SnapshotSchedulerConfig } from './libs/SnapshotScheduler';

/**
 * 주기적 메트릭 스냅샷 캡처를 담당하는 스케줄러입니다.
 */
export { SnapshotScheduler } from './libs/SnapshotScheduler';

/**
 * Timescale 스토어가 요구하는 Postgres 클라이언트 계약입니다.
 */
export type { PostgresClient } from './libs/stores/TimescaleMetricsStore';
// Stores

/**
 * TimescaleDB 기반 메트릭 저장소 구현체입니다.
 */
export { TimescaleMetricsStore } from './libs/stores/TimescaleMetricsStore';

/**
 * metrics-core에서 공통으로 사용하는 핵심 메트릭 타입들입니다.
 */
export type {
  CCComparisonResult,
  CCResult,
  CustomerMetrics,
  GrowthMetrics,
  MetricsSnapshot,
  Money,
  MRRMovement,
  MRRMovementType,
  Percentage,
  Period,
  RetentionMetrics,
} from './types';

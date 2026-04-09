# @croco/metrics-core

MRR, churn, NRR, GRR, Quick Ratio, LTV, carrying capacity를 계산하는 SaaS 지표 엔진입니다.

## 설치

```bash
pnpm add @croco/metrics-core
```

## 사용법

```ts
import { MetricsEngine } from '@croco/metrics-core';

const engine = new MetricsEngine(
  mrrCalculator,
  retentionCalculator,
  growthCalculator,
  carryingCapacityCalculator,
  ltvCalculator,
  snapshotScheduler
);

const mrr = await engine.calculateMRR(subscriptions, planProvider);
const nrr = await engine.calculateNRR(10000, movement);
const ltv = await engine.calculateLTV({ arpa, monthlyChurnRate: 0.03, currency: 'USD' });
```

```ts
import { RetentionCalculator } from '@croco/metrics-core';

const retention = new RetentionCalculator();

await retention.calculateRetention(10000, movement, 120, 114);
```

## API 레퍼런스

### 핵심 클래스

- `MetricsEngine`, 계산기들을 묶어 단일 API로 제공합니다.
- `MrrCalculator`, 구독 스냅샷 기반 MRR을 계산합니다.
- `RetentionCalculator`, churn, GRR, NRR, logo churn을 계산합니다.
- `GrowthCalculator`, Quick Ratio와 성장 지표를 계산합니다.
- `LtvCalculator`, ARPA와 LTV를 계산합니다.
- `CarryingCapacityCalculator`, 운영 수용 한계를 계산합니다.
- `SnapshotScheduler`, 메트릭 스냅샷 생성과 저장을 담당합니다.
- `TimescaleMetricsStore`, TimescaleDB 저장소 구현체입니다.

### 주요 타입

- `MetricsSnapshot`, `GrowthMetrics`, `RetentionMetrics`, `CustomerMetrics`
- `MRRMovement`, `SubscriptionSnapshot`, `PlanSnapshot`
- `Period`, `Money`, `Percentage`
- `RevenueCCConfig`, `UserCCConfig`, `SimulationConfig`, `LtvConfig`

### 인터페이스와 문제 타입

- 인터페이스: `MetricsRepository`, `ActiveUserProvider`, `PlanProvider`, `PostgresClient`
- 문제 타입: `MixedCurrencyMRRProblem`, `GrossMarginRequiredProblem`, `CarryingCapacitySimulationProblem`, `SnapshotTenantRequiredProblem`

## 구현 포인트

- 지표 입력은 billing, membership, metering 스냅샷과 쉽게 결합되도록 타입 중심으로 설계되었습니다.
- `metrics-billing` 패키지를 사용하면 billing 이벤트를 metrics 흐름으로 연결할 수 있습니다.
- 스냅샷 저장소는 `MetricsRepository`를 구현해 교체할 수 있습니다.

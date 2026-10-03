# @croco/metrics-core

MRR, churn, NRR, GRR, Quick Ratio, LTV, carrying capacity를 계산하는 SaaS 지표 엔진입니다.

## 설치

```bash
pnpm add @croco/metrics-core
```

## 사용법

```ts
import { MetricsEngine } from "@croco/metrics-core";

const engine = new MetricsEngine(
  mrrCalculator,
  retentionCalculator,
  growthCalculator,
  carryingCapacityCalculator,
  ltvCalculator,
  snapshotScheduler,
);

const mrr = await engine.calculateMRR(subscriptions, planProvider);
const nrr = await engine.calculateNRR(10000, movement);
const ltv = await engine.calculateLTV({ arpa, monthlyChurnRate: 0.03, currency: "USD" });
```

```ts
import { RetentionCalculator } from "@croco/metrics-core";

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

### 주요 타입

- `MetricsSnapshot`, `GrowthMetrics`, `RetentionMetrics`, `CustomerMetrics`
- `MRRMovement`, `SubscriptionSnapshot`, `PlanSnapshot`
- `Period`, `Money`, `Percentage`
- `RevenueCCConfig`, `UserCCConfig`, `SimulationConfig`, `LtvConfig`

### 인터페이스와 문제 타입

- 인터페이스: `MetricsRepository`, `ActiveUserProvider`, `PlanProvider`
- 문제 타입: `MixedCurrencyMRRProblem`, `GrossMarginRequiredProblem`, `CarryingCapacitySimulationProblem`, `SnapshotTenantRequiredProblem`

## 구현 포인트

- 지표 입력은 billing, membership, metering 스냅샷과 쉽게 결합되도록 타입 중심으로 설계되었습니다.
- `metrics-billing` 패키지를 사용하면 billing 이벤트를 metrics 흐름으로 연결할 수 있습니다.
- 스냅샷 저장소는 `MetricsRepository`를 구현해 교체할 수 있습니다.
- PostgreSQL과 TimescaleDB 구현은 `@croco/warehouse-postgres/metrics`에서 제공합니다.

## 등록 지표와 검증 조회

`defineMetric`은 fact 컬럼의 의미를 명시합니다. 금액은 통화별 그룹이나 통화 필터가 있어야 하며, `int64`와 `decimal` 입력과 결과는 정밀도를 잃지 않도록 문자열로 다룹니다.

```ts typecheck
import { compileMetric, defineMetric, evaluateMetric, project, sum } from "@croco/metrics-core";

const captures = {
  name: "captures",
  kind: "transaction",
  sourceRefs: ["payments"],
  columns: {
    capturedAt: { type: "instant" },
    amountMinor: { type: "money", currency: "currency" },
    currency: { type: "currency" },
  },
} as const;

const definition = defineMetric("cash_received", {
  version: 1,
  from: captures,
  measure: sum(project(captures, "amountMinor")),
  groupByRequired: [project(captures, "currency")],
  time: project(captures, "capturedAt"),
  population: "captured payments",
  unit: "minor",
});
const identity = await compileMetric(definition);
const result = evaluateMetric(
  definition,
  [{ capturedAt: "2026-09-01T00:00:00.000Z", amountMinor: "9007199254740993", currency: "USD" }],
  {
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-10-01T00:00:00.000Z",
  },
);
```

`@croco/metrics-core/runtime`의 `MetricReadService`는 신뢰된 애플리케이션 코드에서만 정의와 조회 executor를 등록합니다. 권한 제공자가 principal, 필드 권한, source revision, snapshot ref, 예산 및 permission/privacy epoch를 공급합니다. 검수된 보고서가 principal, 정의 hash, 기간, 필터, 출처 revision, 품질, 현재 권한과 일치하면 executor를 호출하지 않습니다. 불완전하거나 오래된 보고서는 승인된 출처·품질·진단 metadata와 함께 명시 상태로 반환하고 원본 결과값은 제외합니다. 권한 거부는 metadata 없이 반환합니다. PostgreSQL fact 읽기와 SnapshotSet 고정은 warehouse provider 구현에 속하며 이 경로가 대신 제공하지 않습니다.

`listRegisteredQueries(signal?)`는 현재 권한으로 읽을 수 있는 조회의 ID·version·정의 참조·단위·필드·예산을 반환하며, executor와 schema 함수는 노출하지 않습니다. 정의 목록·설명·보고서·조회 실행 메서드는 마지막 인자로 invocation의 `AbortSignal`을 받습니다. 이 신호와 신뢰 context의 취소 신호를 함께 적용하고, `metrics-core/read-cancelled`와 `metrics-core/read-timeout`을 구분합니다. 등록 input schema의 검증 실패는 원본 오류 내용을 제외한 `metrics-core/invalid-query-input`으로 반환합니다. CLI/MCP에서는 [`@croco/cli/agent`](../cli/README.md#authorized-reads-for-coding-agents)를 통해 같은 서비스를 사용합니다.

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

## Behavior retention and frequency

The pure `computePeriodicRetention`, `computeCohortRetention`, and
`computeFrequencyDistribution` functions accept normalized observations. They do
not require a database and do not change the MRR retention calculators.

```ts no-check
import { computePeriodicRetention } from "@croco/metrics-core";

const result = computePeriodicRetention(definition, dataset, {
  baseline: { kind: "calendar", from: "2024-02-19T00:00:00Z", to: "2024-02-26T00:00:00Z" },
  returning: { kind: "calendar", from: "2024-02-26T00:00:00Z", to: "2024-03-04T00:00:00Z" },
});
```

- A definition fixes `id`, string `version`, `subjectKind`, IANA `timezone`,
  registered `actions`, `deletedSubjectPolicy` (`include` or `exclude`), and
  `historyStart` (the earliest possible behavior, including imported history).
- A dataset carries matching `definitionId`, `version`, `subjectKind`, and
  `timezone`, explicit `{ appId, environment, tenantId }` scope, `events`, optional
  `completeThrough` / `knownHistoryFrom`, and optional `deletedSubjectIds`.
  Every observation carries the same scope plus `subjectId`, `source`, `eventId`,
  `occurredAt`, and `action`. Tenant IDs cannot be omitted or mixed.
- Calendar windows accept explicit offset-qualified instants at local midnight.
  Their elapsed length can change across daylight saving transitions. Rolling
  windows use `{ kind: 'rolling', anchor, durationMs, index }`; each window begins
  at `anchor + durationMs * index`. All windows are half-open `[from, to)`.
- Periodic retention divides baseline subjects active again in the returning
  window by baseline subjects. New returning-window subjects cannot inflate it.
  Cohort retention additionally excludes subjects with earlier registered
  behavior. It reports insufficient history until `knownHistoryFrom` covers
  `historyStart`; it never labels unknown first observations as lifetime first use.
- Missing `completeThrough` or a cutoff before the window end yields
  `provisional`; incomplete history yields `insufficient`. Both return `value:
null` with a reason, while preserving observed counts. Complete zero
  denominators also return `null`. Available values are ratios from zero to one.
- Frequency measures `count` or distinct local `activeDays` among subjects with
  registered activity in the window. Buckets expose subject counts and their
  denominator; the result-level numerator and denominator describe the active
  population. A zero-frequency population requires a separate subject registry
  and is not inferred from event rows.
- Only retransmissions with the same scope, source, event ID, subject, action,
  and instant are deduplicated. Conflicting identities throw
  `ConflictingBehaviorEventProblem`; malformed definitions, scope, timestamps,
  and windows throw `InvalidBehaviorMetricProblem` with a stable `field`.
- Deletion never silently changes a denominator: `include` preserves subjects;
  `exclude` records excluded subjects with reason `deleted`. Definitions must
  change version when their policies change. Results include source references
  and subject membership with inclusion reasons, action counts, and active days
  for server-side authorized, bounded drilldown. Do not expose whole datasets or
  these subject lists directly to untrusted browser clients.

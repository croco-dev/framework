# @croco/metrics-core

MRR, churn, NRR, GRR, Quick Ratio, LTV, carrying capacity를 계산하는 SaaS 지표 엔진입니다.

## 배정자당 수납·환불·비용 비교

`OutcomeLedgerNormalizer`와 `compareAssignedOutcomes`는 고정 배정표에 포함된 모든 unit을 분모로 사용합니다.
수납에서 환불, 별도 현금성 보상, 확정 직접 발송비를 차감합니다. 수납에 반영된 할인은 다시 차감하지 않으며,
noncash 액면은 별도로 표시합니다. 포함하지 않은 비용이 있으므로 결과는 영업이익이나 순이익이 아닙니다.

금액은 정수 minor-unit 문자열, 인당 금액과 군 간 차이는 `{ numerator, denominator }` 문자열 분수입니다.
통화별로 계산하며 자동 FX 환산이나 통화 합산을 하지 않습니다. 관측된 차이는 causal uplift를 뜻하지 않습니다.
각 100명을 배정하고 control 수납 100000/환불 20000, test 수납 110000/환불 15000/현금보상 20000/발송비 1000이면
인당 금액은 800/740, test−control 차이는 −60입니다.

| 입력 상태                               | 처리                                              |
| --------------------------------------- | ------------------------------------------------- |
| 같은 source/eventId의 동일 재전송       | 한 사건으로 계산                                  |
| 같은 source/eventId의 상충 payload      | `OutcomeProblem`                                  |
| source ref가 있는 correction            | 별도 row가 원 row를 대체하며 과거 cutoff에서 재현 |
| effective/known cutoff 이후 row         | 해당 revision에서 제외                            |
| subject 누락·미배정 사건·연결 없는 환불 | 사유와 제외 수를 남기는 부분 결과                 |
| 누락 비용·미확정 provider·pending 환불  | 알려진 구성 금액만 표시, 인당 비교와 차이는 null  |
| 분모 0                                  | 인당 금액과 해당 차이는 null                      |

각 arm/source/kind/currency의 coverage를 명시해야 확정 0과 누락 입력을 구분할 수 있습니다. 보존되지 않은 리텐션 정보는
0%가 아닌 null입니다. 환불률의 분모는 수납한 배정 subject, 리텐션율의 분모는 전체 배정 unit입니다.
리텐션 입력은 host가 같은 배정표·effective/known cutoff에 맞춰 확정한 상태이며, 이 계산기가 별도 관측 기간을 추정하지 않습니다.
고정 정의는 `ASSIGNED_OUTCOME_DEFINITION`이며 서버는 `hashAssignedOutcomeDefinition`과 `hashAssignedOutcomeInput`으로
정의와 배정표·원천·cutoff·revision의 입력 hash를 검증합니다. 순수 계산 API는 저장소나 worker를 시작하지 않습니다.

`createWarehouseAssignedOutcomeLoader`를 사용하는 native 조회는 `events: []`와 해당 요청의
`hashAssignedOutcomeInput` 값을 제출합니다. 호출자는 warehouse row를 미리 읽거나 그 hash를 알 필요가 없습니다.
loader는 고정 snapshot에서 row를 읽은 뒤 전체 입력의 hash를 계산하고, 보고서는 이 실제 입력 hash를 기록합니다.
순수 조회는 제출한 전체 입력 hash를 계속 검증합니다. 조회 cache는 제출 요청 전체의 digest와 권한 context의
source revision·snapshot ref에 연결됩니다.

이 loader는 하나의 canonical `WarehouseSnapshot`을 읽습니다. 여러 source를 등록할 수 있지만 각 source revision은
고정 snapshot revision과 같아야 하며, 각 source에 대응하는 snapshot ref도 모두 같은 snapshot id여야 합니다.
모든 source가 snapshot의 source coverage에 있어야 합니다. 공유 snapshot은 한 번만 순회하여 금액을 중복 계산하지
않습니다. 서로 다른 snapshot이나 revision은 읽기 전에 거부하며, 별도 snapshot을 결합하지 않습니다.

DB 없는 실제 계산과 관리 화면 예제는 `examples/assigned-outcomes`에 있습니다. 원문 보관·삭제·masking·접근 권한은
기존 host의 source boundary가 소유하며, 관리 화면에는 원 배정 subject와 원천 사건 식별자가 전달되지 않습니다.

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

`@croco/metrics-core/runtime`의 `MetricReadService`는 신뢰된 애플리케이션 코드에서만 정의와 조회 executor를 등록합니다. 권한 제공자가 principal, 필드 권한, source revision, snapshot ref, 예산 및 permission/privacy epoch를 공급합니다. 검수된 보고서가 principal, 정의 hash, 기간, 필터, 출처 revision, 품질, 현재 권한과 일치하면 executor를 호출하지 않습니다. 불완전하거나 오래된 보고서는 승인된 출처·품질·진단 metadata와 함께 명시 상태로 반환하고 기본적으로 원본 결과값은 제외합니다. 등록 query가 `partialDataPolicy: "authorized"`를 명시한 경우에만 현재 권한을 재검증한 부분 결과를 포함합니다. 오래된 결과값은 항상 제외합니다. 권한 거부는 metadata 없이 반환합니다. PostgreSQL fact 읽기와 SnapshotSet 고정은 warehouse provider 구현에 속하며 이 경로가 대신 제공하지 않습니다.

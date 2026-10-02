# @croco/metrics-billing

## 배정자당 성과 원천 매핑

`billingOrderOutcome`은 `Order`와 `BillingAccount`의 tenant 연결을 확인하고 실제 수납 minor-unit을 매핑합니다.
subject와 observed time은 host가 명시적으로 제공합니다. billing에는 환불 조회 계약이 없으므로
`settledRefundOutcome`은 확정 원천 row와 연결 payment ID를 요구합니다.

`creditGrantOutcome`은 credit units와 명시적인 통화별 액면 valuation을 분리합니다. 자동 현금 환산은 없습니다.
`engagementContactCostOutcome`은 dispatch와 연결된 확정 비용 영수증이 있을 때만 비용 사건을 만듭니다.
`queued`나 provider acceptance만으로 비용을 확정하지 않으며 영수증이 없으면 `missing`을 반환합니다.
host는 이 결과를 `compareAssignedOutcomes`의 비용 coverage에 반영해야 합니다. 별도 금융 원장을 만들지 않습니다.

Billing 도메인 이벤트를 Metrics 계산으로 연결하는 파이프라인 패키지입니다.

## 설치

```bash
pnpm add @croco/metrics-billing @croco/warehouse-postgres
```

## 개요

이 패키지는 `@croco/billing-core`에서 발생하는 도메인 이벤트를 수신하여 `@croco/metrics-core`의 메트릭 계산 엔진으로 전달합니다.

### 지원하는 이벤트

| 이벤트                      | 설명           | MRR Movement                                      |
| --------------------------- | -------------- | ------------------------------------------------- |
| `OrderPaidEvent`            | 주문 결제 완료 | 결제 사유에 따라 `new`, `reactivation`, 또는 없음 |
| `PlanChangedEvent`          | 플랜 변경      | `expansion` 또는 `contraction`                    |
| `SubscriptionCanceledEvent` | 구독 취소      | 실제 취소 시 `churned`, 기간 말 예약 시 없음      |
| `SubscriptionRevokedEvent`  | 구독 접근 종료 | `churned`                                         |

## 사용법

```typescript
import { BillingEventHandler } from "@croco/metrics-billing";
import { PostgresMetricsStore } from "@croco/warehouse-postgres/metrics";
import { Container } from "@croco/framework-context";

const metricsRepository = new PostgresMetricsStore(db);
const handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);

await eventBus.publish(
  new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", "subscription_create"),
);
```

### DI 컨테이너 등록

```typescript
import { Container } from "@croco/framework-context";
import { BillingEventHandler } from "@croco/metrics-billing";

Container.register(BillingEventHandler, {
  planRegistry: Container.resolve(PlanRegistry),
  billingStore: Container.resolve(BillingStore),
  metricsRepository: Container.resolve(MetricsRepository),
});
```

## MRR 변동 계산

### OrderPaidEvent

- `subscription_create`: `new` MRR 기록
- `subscription_reactivation`: `reactivation` MRR 기록
- `subscription_cycle`: 갱신 결제이므로 MRR movement를 기록하지 않음
- `subscription_update`, `one_time`: 활성 구독 MRR을 새로 만들지 않으므로 movement를 기록하지 않음
- 연간 플랜: 월별 MRR로 정규화한 뒤 구독별로 가장 가까운 정수 minor unit으로 반올림합니다 (정확히 절반이면 0에서 먼 방향).

### PlanChangedEvent

- 업그레이드: `expansion` MRR 기록 (차액)
- 다운그레이드: `contraction` MRR 기록 (차액)
- 동일 금액: `unchanged` (0)

### SubscriptionCanceledEvent

- `cancelAtPeriodEnd: false`: `churned` MRR 기록
- `cancelAtPeriodEnd: true`: 구독이 활성 상태이므로 MRR movement를 기록하지 않음
- 이벤트의 `planVersionRef`로 취소 시점에 고정된 플랜 버전을 조회합니다. 즉시 취소로 구독이나 계정이 삭제되어도 해당 버전의 금액으로 집계합니다.
- `BillingService`와 Polar 이벤트 매퍼는 취소 이벤트에 `planVersionRef`를 포함합니다. 이전 버전의 이벤트처럼 이 값이 없으면 기존 구독에서 플랜 버전을 조회합니다.

### SubscriptionRevokedEvent

- 기간 말 취소가 효력을 갖거나 결제 재시도가 소진되어 구독 접근이 끝나면 `churned` MRR을 기록합니다.
- Polar 이벤트 매퍼는 `planVersionRef`를 포함합니다. 이전 버전의 이벤트처럼 이 값이 없으면 기존 구독에서 플랜 버전을 조회합니다.
- 즉시 취소 이벤트와 revoked 이벤트가 모두 도착해도 구독 단위 churn 키를 공유하여 한 번만 기록합니다.

## 멱등성

이벤트 키를 기반으로 멱등성을 보장합니다:

```
eventKey = `${eventName}_${event.eventId}`
```

동일한 이벤트 키로 중복 호출되면 PostgresMetricsStore의 atomic claim이 처리합니다.
서로 다른 billing event는 같은 millisecond에 발생해도 `DomainEvent.eventId`가 다르므로
각각의 primary key를 가집니다. 단, 같은 구독의 취소와 revoked는 아래 churn alias를 공유합니다.

이전 버전은 `${eventName}_${timestamp.getTime()}` 형식의 timestamp 기반 키를 사용했습니다.
`BillingEventHandler`는 primary key로 `eventId` 기반 키를 전달합니다. 기존에 movement를 기록하던
이벤트는 timestamp 기반 키를 `legacyEventKeys`로 함께 전달합니다. revoked는 기존
movement가 없으므로 이 조회 키를 사용하지 않습니다. PostgresMetricsStore는 같은 tenant의 과거 movement에
해당 primary key가 있으면 새 movement insert를 건너뜁니다. 조회 키는 claim하지 않으므로 신규 독립 이벤트가
같은 timestamp를 가져도 각각 기록됩니다. 이전 writer가 신규 이벤트에 붙인 timestamp alias claim은
과거 movement의 primary key가 아니므로 replay 판단에 사용하지 않습니다.
취소와 revoked의 churn movement에는 `billing.subscription_churned_${externalSubscriptionId}` 키도
alias로 전달하여 이벤트 순서와 관계없이 구독당 한 번만 기록합니다.

`MetricsRepository` 구현체는 `mrrMovementIdentityVersion: 2`를 명시해야 합니다.
handler는 생성 시 이 값을 검사하며, 없거나 다른 버전이면
`metrics-billing/repository-contract-unsupported` Problem으로 실패합니다. metrics-core와 metrics-billing을
업그레이드할 때 warehouse-postgres도 함께 업그레이드해야 합니다. custom provider는 tenant 범위의
과거 primary-key 조회를 구현한 뒤 버전 2를 선언해야 합니다. 기존 provider에 버전 값만 붙이면 안 됩니다.

## Failure semantics

billing 이벤트가 metric으로 기록되지 못하는 경우를 성공처럼 숨기지 않습니다.
`BillingEventHandler`는 필요한 account, subscription, plan evidence가 없으면
`BillingMetricDroppedProblem`을 throw합니다. 취소 또는 revoked 이벤트에 `planVersionRef`가 있으면 account나 subscription 조회는 필요하지 않지만, 해당 플랜 버전은 유지되어야 합니다. repository 기록이 실패하면
`BillingMetricRecordingProblem`을 throw합니다.

| Problem                         | Code                               | Recovery                                                                                                                        |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `BillingMetricDroppedProblem`   | `metrics-billing/metric-dropped`   | `extensions.reason`, `tenantId`, `resourceId`, `eventKey`로 누락된 billing state를 복구한 뒤 같은 billing event를 재처리합니다. |
| `BillingMetricRecordingProblem` | `metrics-billing/recording-failed` | metrics repository 장애를 복구한 뒤 `eventKey` 기반으로 같은 이벤트를 재시도합니다.                                             |

문제 extensions에는 raw billing payload나 secret이 아니라 event name, tenant id, idempotency
event key, drop reason, resource id만 포함됩니다.

## Dependencies

- `@croco/billing-core` - Billing 도메인 이벤트
- `@croco/events-core` - EventHandler 인터페이스
- `@croco/metrics-core` - Metrics 계산 및 저장
- `@croco/problems-core` - dropped/recording failure Problem

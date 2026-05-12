# @croco/metrics-billing

Billing 도메인 이벤트를 Metrics 계산으로 연결하는 파이프라인 패키지입니다.

## 설치

```bash
pnpm add @croco/metrics-billing
```

## 개요

이 패키지는 `@croco/billing-core`에서 발생하는 도메인 이벤트를 수신하여 `@croco/metrics-core`의 메트릭 계산 엔진으로 전달합니다.

### 지원하는 이벤트

| 이벤트                      | 설명           | MRR Movement                   |
| --------------------------- | -------------- | ------------------------------ |
| `OrderPaidEvent`            | 주문 결제 완료 | `new`                          |
| `PlanChangedEvent`          | 플랜 변경      | `expansion` 또는 `contraction` |
| `SubscriptionCanceledEvent` | 구독 취소      | `churned`                      |

## 사용법

```typescript
import { BillingEventHandler } from "@croco/metrics-billing";
import { TimescaleMetricsStore } from "@croco/metrics-core";
import { Container } from "@croco/framework-context";

const metricsRepository = new TimescaleMetricsStore(db);
const handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);

await eventBus.publish(new OrderPaidEvent("tenant-1", "order-1", 2900, "USD"));
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

- 신규 구독: `new` MRR 기록
- 연간 플랜: 월별 MRR로 정규화 (amount / 12)

### PlanChangedEvent

- 업그레이드: `expansion` MRR 기록 (차액)
- 다운그레이드: `contraction` MRR 기록 (차액)
- 동일 금액: `unchanged` (0)

### SubscriptionCanceledEvent

- `churned` MRR 기록
- 취소 시점의 플랜 금액 기준

## 멱등성

이벤트 키를 기반으로 멱등성을 보장합니다:

```
eventKey = `${eventName}_${timestamp.getTime()}`
```

동일한 이벤트 키로 중복 호출되면 TimescaleMetricsStore의 `ON CONFLICT DO NOTHING`이 처리합니다.

## Dependencies

- `@croco/billing-core` - Billing 도메인 이벤트
- `@croco/events-core` - EventHandler 인터페이스
- `@croco/metrics-core` - Metrics 계산 및 저장

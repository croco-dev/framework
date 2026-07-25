# @croco/billing-core

구독, 체크아웃, 플랜 전환, 통화 계산을 담당하는 빌링 도메인 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/billing-core
```

## 사용법

```ts
import type { BillingGateway } from "@croco/billing-core";
import { BillingService, InMemoryBillingStore, InMemoryPlanRegistry } from "@croco/billing-core";

const planRegistry = new InMemoryPlanRegistry();
const store = new InMemoryBillingStore(planRegistry);
const gateway = {} as BillingGateway;
const billingService = new BillingService({ store, gateway });

await billingService.createCheckout({
  tenantId: "tenant-123",
  email: "owner@example.com",
  productId: "product-pro",
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});
```

```ts
import { Money } from "@croco/billing-core";

const monthly = new Money(9900, "USD");
const annual = monthly.multiply(12).subtract(new Money(19800, "USD"));

monthly.toFormattedString("ko-KR");
annual.toString();
```

## 변경 불가능한 플랜 버전

```ts
import { InMemoryPlanRegistry, planVersionRef } from "@croco/billing-core";

const planRegistry = new InMemoryPlanRegistry([
  {
    ref: planVersionRef("pro@2026-01"),
    planId: "pro",
    version: "2026-01",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2025-12-01T00:00:00.000Z",
    plan: {
      id: "pro",
      name: "Pro",
      amount: 2900,
      currency: "USD",
      interval: "month",
      intervalCount: 1,
    },
    rating: { mode: "provider-rated" },
    providerBindings: [
      {
        provider: "polar",
        productId: "polar-pro",
        priceId: "price-pro-2026-01",
      },
    ],
  },
]);
```

`planId`는 상품군을 식별하고 `PlanVersionRef`는 게시된 가격과 provider binding을 식별합니다.
`getPlanAtDate()`는 익명 `Plan` 값이 아니라 해당 ref가 포함된 버전을 반환하며, 같은 ref는 다시 게시할 수
없습니다. `Subscription.planVersionRef`는 일반 `saveSubscription()`으로 변경할 수 없습니다.

기존 영속 저장소는 `findLegacySubscriptions()`로 ref가 없는 레코드를 찾고,
`migrateSubscriptionPlanVersion()`에 운영자가 선택한 `planId`와 `planVersionRef`를 전달해야 합니다.
`BillingStore`는 생성 시 주입된 `PlanRegistry`로 일반 저장과 마이그레이션 모두 exact ref가 게시되어
있고 같은 plan family에 속하는지 확인하며 최신 버전을 자동 선택하지 않습니다. 커스텀 `BillingStore`
adapter는 보호된 persistence 메서드를 구현하고 마이그레이션 pin을 compare-and-set 방식으로 원자적으로
저장해야 합니다.

## API 레퍼런스

### 핵심 클래스와 인터페이스

- `BillingService`, 테넌트 기준 구독 조회, 체크아웃 생성, 취소, 재개를 처리합니다.
- `BillingStore`, billing account, subscription, order 저장 계약입니다.
- `BillingGateway`, 외부 결제 제공자 연동 계약입니다.
- `InMemoryBillingStore`, 테스트용 인메모리 저장소입니다.
- `Money`, 통화 안전 계산용 값 객체입니다.

### 확장 포인트

- `PlanRegistry`, 게시된 플랜 버전의 조회, 날짜 조회, provider mapping 계약입니다.
- `InMemoryPlanRegistry`, publish-once 동작을 제공하는 인메모리 구현입니다.
- `PlanTransitionService`, 플랜 전환 미리보기와 적용 인터페이스입니다.
- `ProrationCalculator`, 일할 계산 인터페이스입니다.
- `InvoiceGenerator`, 인보이스 생성 인터페이스입니다.

### 주요 타입

- `BillingAccount`, `Subscription`, `Order`, `Invoice`, `Plan`
- `PlanVersionRef`, `PlanVersionDefinition`, `ProviderPriceBinding`
- `CreateCheckoutParams`, `CheckoutResult`
- `CreateBillingCheckoutParams`, `BillingServiceDependencies`
- `PlanTransitionParams`, `ProrationCalculationParams`, `GenerateInvoiceParams`

### 이벤트와 문제 타입

- 이벤트: `OrderPaidEvent`, `PlanChangedEvent`, `SubscriptionActivatedEvent`, `SubscriptionCanceledEvent`, `SubscriptionPastDueEvent`, `SubscriptionRevokedEvent`
- 문제 타입: `BillingAccountNotFoundProblem`, `BillingCheckoutCreationProblem`, `SubscriptionNotFoundProblem`, `UnknownPlanVersionMappingProblem`

## 구현 포인트

- 외부 결제사는 `BillingGateway`를 구현해 연결합니다.
- 즉시 취소 시 주문 이력이 없으면 billing account와 subscription을 함께 정리합니다.
- billing 상태 변화는 도메인 이벤트로 다른 SaaS 패키지와 연결할 수 있습니다.

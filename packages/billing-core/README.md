# @croco/billing-core

구독, 체크아웃, 플랜 전환, 통화 계산을 담당하는 빌링 도메인 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/billing-core @croco/idempotency-core
```

## 사용법

```ts
import type { BillingGateway } from "@croco/billing-core";
import { BillingService, InMemoryBillingStore } from "@croco/billing-core";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";

const store = new InMemoryBillingStore();
const gateway = {} as BillingGateway;
const billingService = new BillingService({
  store,
  gateway,
  // Local development only. Production adapters must be durable and shared by every instance.
  checkoutIdempotencyStore: new InMemoryIdempotencyStore(),
});

await billingService.createCheckout({
  tenantId: "tenant-123",
  email: "owner@example.com",
  productId: "product-pro",
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
  idempotencyKey: "checkout-order-123",
});
```

### 명시적 provider capability

`BillingGateway`는 기존 checkout 전용 구현과 source-compatible하게 유지됩니다. 런타임에서 provider를
선택하는 경로는 별도 profile과 구현을 조합해 지원 capability를 검사합니다.

```ts
import {
  defineBillingProvider,
  defineBillingProviderProfile,
  type BillingGateway,
  type UsageBillingGateway,
} from "@croco/billing-core";

const profile = defineBillingProviderProfile({
  providerName: "example",
  capabilities: {
    checkout: { supported: true },
    usage: { supported: true },
  },
});

const provider = defineBillingProvider(profile, {
  checkout: checkoutGateway satisfies BillingGateway,
  usage: usageGateway satisfies UsageBillingGateway,
});

await provider.requireCapability("usage").ingest([
  {
    eventId: "request-123",
    billingAccountId: "account-123",
    meterId: "ai.tokens",
    value: 100,
    occurredAt: new Date(),
    dimensions: { model: "gpt-5" },
  },
]);
```

`UsageBillingGateway.ingest()`는 배치별로 `inserted` 또는 `duplicate` 영수증을 반환합니다. duplicate는
실패나 no-op 성공으로 숨기지 않고 명시적인 성공 acknowledgement입니다. 지원하지 않는 capability를
`requireCapability()`로 요청하면 `billing/provider-capability-unavailable` Problem이 발생합니다.

```ts
import { Money } from "@croco/billing-core";

const monthly = new Money(9900, "USD");
const annual = monthly.multiply(12).subtract(new Money(19800, "USD"));

monthly.toFormattedString("ko-KR");
annual.toString();
```

### Money 반올림

`Money.fromDecimal()`, `multiply()`, `divide()`는 소수 minor unit을 반올림할 때
`MoneyRoundingMode`를 받습니다. 양수와 음수에 같은 방향 규칙을 적용합니다.

- `half_up`: 가장 가까운 minor unit으로 반올림하고, 정확히 절반이면 0에서 멀어지는 방향으로 반올림합니다.
- `down`: 0을 향해 버립니다.
- `up`: 0에서 멀어지는 방향으로 올립니다.

예를 들어 `new Money(1, "USD").divide(-2)`는 기본 `half_up`에서 `-1`이고,
`down`에서는 `0`, `up`에서는 `-1`입니다.

## API 레퍼런스

### 핵심 클래스와 인터페이스

- `BillingService`, 테넌트 기준 구독 조회, 체크아웃 생성, 취소, 재개를 처리합니다.
- `BillingStore`, billing account, subscription, order 저장 계약입니다.
- `BillingGateway`, 외부 결제 제공자 연동 계약입니다.
- `UsageBillingGateway`, 배치 usage 수신과 customer meter state 조회 계약입니다.
- `BillingProvider`, inspectable capability profile과 런타임 구현을 조합합니다.
- `InMemoryBillingStore`, 테스트용 인메모리 저장소입니다.
- `InMemoryPlanRegistry`, 게시 후 변경할 수 없는 플랜 버전을 조회하는 인메모리 레지스트리입니다.
- `Money`, 통화 안전 계산용 값 객체입니다.

### 확장 포인트

- `PlanRegistry`, 플랜 버전 게시·과거 조회·provider mapping 해석 계약입니다.
- `PlanTransitionService`, 플랜 전환 미리보기와 적용 인터페이스입니다.
- `ProrationCalculator`, 일할 계산 인터페이스입니다.
- `InvoiceGenerator`, 인보이스 생성 인터페이스입니다.

### 주요 타입

- `BillingAccount`, `Subscription`, `Order`, `Invoice`, `Plan`, `PlanVersionDefinition`
- `CreateCheckoutParams`, `CheckoutResult`
- `UsageBillingEvent`, `UsageBillingEventReceipt`, `CustomerMeterState`
- `CreateBillingCheckoutParams`, `BillingServiceDependencies`
- `PlanTransitionParams`, `ProrationCalculationParams`, `GenerateInvoiceParams`

### 이벤트와 문제 타입

- 이벤트: `OrderPaidEvent`, `PlanChangedEvent`, `SubscriptionActivatedEvent`, `SubscriptionCanceledEvent`, `SubscriptionPastDueEvent`, `SubscriptionRevokedEvent`
- 문제 타입: `BillingAccountNotFoundProblem`, `BillingCheckoutCreationProblem`, `BillingCheckoutInProgressProblem`, `ProviderCapabilityUnavailableProblem`, `SubscriptionNotFoundProblem`, `InvalidMoneyAmountProblem`

## 구현 포인트

- 외부 결제사는 `BillingGateway`를 구현해 연결합니다.
- 체크아웃 호출자는 같은 논리적 구매 의도에 같은 `idempotencyKey`를 재사용해야 합니다. 운영 환경의
  `checkoutIdempotencyStore`는 모든 애플리케이션 인스턴스가 공유하는 durable adapter여야 합니다.
- `BillingGateway.createCheckout()` 구현은 전달된 provider operation key로 같은 checkout session을
  반환해야 합니다. 응답 수신이나 멱등성 저장소 commit 결과가 모호하면
  `BillingGateway.reconcileCheckout()`이 새 session을 만들지 않고 기존 결과만 조회해야 합니다.
- 즉시 취소 시 주문 이력이 없으면 billing account와 subscription을 함께 정리합니다.
- billing 상태 변화는 도메인 이벤트로 다른 SaaS 패키지와 연결할 수 있습니다.

## 불변 플랜 버전

```ts
import {
  InMemoryPlanRegistry,
  migrateSubscriptionPlanVersion,
  planVersionRef,
} from "@croco/billing-core";

const registry = new InMemoryPlanRegistry();
const pro2026 = planVersionRef("pro@2026-01");

await registry.publishPlanVersion({
  ref: pro2026,
  planId: "pro",
  versionId: "2026-01",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  name: "Pro",
  amount: 9900,
  currency: "USD",
  interval: "month",
  intervalCount: 1,
  rating: { mode: "provider", provider: "polar" },
  providerBindings: [
    {
      provider: "polar",
      productId: "polar-pro-2026",
      priceIds: ["polar-price-2026"],
    },
  ],
});
```

`getPlanAtDate()`는 익명 가격 값이 아니라 `ref`가 포함된 게시 버전을 반환합니다. 같은 참조,
같은 plan family의 version/effective time, 또는 같은 provider product/price mapping은 다시
게시할 수 없습니다.

기존 저장소 레코드는 최신 버전을 자동 선택하지 않습니다. 배포 전에 각 레코드의 기존 provider
product/price 또는 배포 이력을 사용해 정확한 `PlanVersionRef`를 정하고,
`migrateSubscriptionPlanVersion(legacySubscription, explicitRef, registry)`로 plan family 일치 여부를
검증한 뒤 `planVersionRef` 컬럼을 `NOT NULL`로 전환해야 합니다.

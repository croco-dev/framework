# @croco/billing-core

구독, 체크아웃, 플랜 전환, 통화 계산을 담당하는 빌링 도메인 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/billing-core
```

## 사용법

```ts
import type { BillingGateway } from '@croco/billing-core';
import { BillingService, InMemoryBillingStore } from '@croco/billing-core';

const store = new InMemoryBillingStore();
const gateway = {} as BillingGateway;
const billingService = new BillingService({ store, gateway });

await billingService.createCheckout({
  tenantId: 'tenant-123',
  email: 'owner@example.com',
  productId: 'product-pro',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});
```

```ts
import { Money } from '@croco/billing-core';

const monthly = new Money(9900, 'USD');
const annual = monthly.multiply(12).subtract(new Money(19800, 'USD'));

monthly.toFormattedString('ko-KR');
annual.toString();
```

## API 레퍼런스

### 핵심 클래스와 인터페이스

- `BillingService`, 테넌트 기준 구독 조회, 체크아웃 생성, 취소, 재개를 처리합니다.
- `BillingStore`, billing account, subscription, order 저장 계약입니다.
- `BillingGateway`, 외부 결제 제공자 연동 계약입니다.
- `InMemoryBillingStore`, 테스트용 인메모리 저장소입니다.
- `Money`, 통화 안전 계산용 값 객체입니다.

### 확장 포인트

- `PlanRegistry`, 플랜 정의 조회 계약입니다.
- `PlanTransitionService`, 플랜 전환 미리보기와 적용 인터페이스입니다.
- `ProrationCalculator`, 일할 계산 인터페이스입니다.
- `InvoiceGenerator`, 인보이스 생성 인터페이스입니다.

### 주요 타입

- `BillingAccount`, `Subscription`, `Order`, `Invoice`, `Plan`
- `CreateCheckoutParams`, `CheckoutResult`
- `CreateBillingCheckoutParams`, `BillingServiceDependencies`
- `PlanTransitionParams`, `ProrationCalculationParams`, `GenerateInvoiceParams`

### 이벤트와 문제 타입

- 이벤트: `OrderPaidEvent`, `PlanChangedEvent`, `SubscriptionActivatedEvent`, `SubscriptionCanceledEvent`, `SubscriptionPastDueEvent`, `SubscriptionRevokedEvent`
- 문제 타입: `BillingAccountNotFoundProblem`, `BillingCheckoutCreationProblem`, `SubscriptionNotFoundProblem`, `InvalidMoneyAmountProblem`

## 구현 포인트

- 외부 결제사는 `BillingGateway`를 구현해 연결합니다.
- 즉시 취소 시 주문 이력이 없으면 billing account와 subscription을 함께 정리합니다.
- billing 상태 변화는 도메인 이벤트로 다른 SaaS 패키지와 연결할 수 있습니다.

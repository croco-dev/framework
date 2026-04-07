# @croco/billing-core

Croco의 빌링 코어 도메인 패키지입니다. 구독 상태 조회, 체크아웃 생성, 통화 값객체, 인보이스/플랜 전환 인터페이스를 제공합니다.

## 설치

```bash
pnpm add @croco/billing-core
```

## Money 값객체

```ts
import { Money } from '@croco/billing-core';

const monthly = new Money(9900, 'USD');
const annualDiscount = monthly.multiply(10).subtract(new Money(9900, 'USD'));

monthly.toString();
annualDiscount.toFormattedString('en-US');
```

## BillingService

```ts
import type { BillingGateway } from '@croco/billing-core';
import { BillingService, InMemoryBillingStore } from '@croco/billing-core';

const store = new InMemoryBillingStore();
const gateway = {} as BillingGateway;
const service = new BillingService({ store, gateway });

await service.createCheckout({
  tenantId: 'tenant-123',
  email: 'owner@example.com',
  productId: 'product-pro',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});
```

즉시 구독 취소 시 주문 이력이 없는 계정은 자동 정리되어 고아 billing account가 남지 않습니다.

## 플랜 전환과 인보이스 인터페이스

```ts
import type {
  GenerateInvoiceParams,
  InvoiceGenerator,
  PlanTransitionService,
  ProrationCalculator,
} from '@croco/billing-core';

declare const prorationCalculator: ProrationCalculator;
declare const planTransitionService: PlanTransitionService;
declare const invoiceGenerator: InvoiceGenerator;

await prorationCalculator.calculate({
  currentPlan,
  nextPlan,
  periodStart: new Date('2026-01-01T00:00:00.000Z'),
  periodEnd: new Date('2026-02-01T00:00:00.000Z'),
  changeAt: new Date('2026-01-15T00:00:00.000Z'),
});

await planTransitionService.previewTransition({
  subscription,
  currentPlan,
  nextPlan,
  effectiveAt: new Date(),
});

const params: GenerateInvoiceParams = {
  invoiceId: 'inv-1',
  billingAccountId: 'account-1',
  currency: 'USD',
  lineItems: [],
  issuedAt: new Date(),
};

await invoiceGenerator.generate(params);
```

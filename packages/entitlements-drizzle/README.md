# @croco/entitlements-drizzle

`@croco/entitlements-core`용 Drizzle 구현체입니다.

## 설치

```bash
pnpm add @croco/entitlements-drizzle @croco/entitlements-core drizzle-orm
```

## 사용법

```typescript
import {
  BILLING_STORE_TOKEN,
  BillingStoreSubscriptionProvider,
  DRIZZLE_TOKEN,
  DrizzlePlanEntitlementRegistry,
} from '@croco/entitlements-drizzle';
import { Container } from '@croco/framework-context';

Container.set(DRIZZLE_TOKEN, db);
Container.set(BILLING_STORE_TOKEN, billingStore);

const registry = new DrizzlePlanEntitlementRegistry(db);
const provider = new BillingStoreSubscriptionProvider(billingStore);

const entitlements = await registry.getEntitlements('pro-plan');
const rule = await registry.findRule('pro-plan', 'api_calls');
const planId = await provider.getCurrentPlanId('tenant-123');
```

## API 레퍼런스

### DrizzlePlanEntitlementRegistry


- `getEntitlements(planId)`, 플랜의 모든 권한 규칙을 반환합니다.
- `findRule(planId, featureKey)`, 특정 기능의 규칙 하나를 반환합니다.

### BillingStoreSubscriptionProvider


- `getCurrentPlanId(tenantId)`, 빌링 구독에서 현재 플랜 ID를 찾습니다.

### Schema


- `planEntitlements`, 플랜과 기능 키 조합별 entitlement 규칙을 저장합니다.
- `DRIZZLE_TOKEN`, 레지스트리용 Drizzle 클라이언트 토큰입니다.
- `BILLING_STORE_TOKEN`, 구독 제공자용 빌링 스토어 토큰입니다.

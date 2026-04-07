# @croco/entitlements-drizzle

@croco/entitlements-core의 Drizzle ORM 기반 구현체입니다.

## 개요

`entitlements-drizzle`은 플랜별 entitlement(기능 사용권)를 Drizzle ORM으로 관리하는 저장소 구현체를 제공합니다.

## 설치

```bash
pnpm add @croco/entitlements-drizzle @croco/entitlements-core drizzle-orm
```

## 데이터베이스 스키마

```sql
CREATE TABLE plan_entitlements (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('boolean', 'metered', 'static')),
  value INTEGER,
  meter_id TEXT,
  quota INTEGER,
  overage_policy TEXT DEFAULT 'block' CHECK (overage_policy IN ('block', 'warn', 'allow')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plan_entitlements_plan_id ON plan_entitlements(plan_id);
CREATE UNIQUE INDEX idx_plan_entitlements_unique ON plan_entitlements(plan_id, feature_key);
```

## 사용법

### DrizzlePlanEntitlementRegistry

```typescript
import { DrizzlePlanEntitlementRegistry } from '@croco/entitlements-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const registry = new DrizzlePlanEntitlementRegistry(db);

// 플랜의 모든 entitlement 조회
const entitlements = await registry.getEntitlements('pro-plan');

// 특정 기능의 entitlement 조회
const rule = await registry.findRule('pro-plan', 'api_calls');
```

### BillingStoreSubscriptionProvider

```typescript
import { BillingStoreSubscriptionProvider, BILLING_STORE_TOKEN } from '@croco/entitlements-drizzle';
import { Container } from '@croco/framework-context';

Container.set(BILLING_STORE_TOKEN, billingStore);

const provider = new BillingStoreSubscriptionProvider(billingStore);
const planId = await provider.getCurrentPlanId('tenant-123');
```

### DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject } from '@croco/framework-context';
import { EntitlementManager, PlanEntitlementRegistry } from '@croco/entitlements-core';
import { DrizzlePlanEntitlementRegistry, DRIZZLE_TOKEN } from '@croco/entitlements-drizzle';

const DRIZZLE_DB_TOKEN = 'DRIZZLE_DB_TOKEN';

Container.set(PlanEntitlementRegistry.token, {
  factory: () => {
    const db = Container.get(DRIZZLE_DB_TOKEN);
    return new DrizzlePlanEntitlementRegistry(db);
  },
});

@Component()
class MyService {
  constructor(
    @Inject(PlanEntitlementRegistry.token) private registry: DrizzlePlanEntitlementRegistry
  ) {}

  async checkFeature(tenantId: string, featureKey: string) {
    const entitlements = await this.registry.getEntitlements('pro-plan');
    return entitlements.find(e => e.featureKey === featureKey);
  }
}
```

## API

### DrizzlePlanEntitlementRegistry

`PlanEntitlementRegistry` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(db: DrizzleDb & { select: DrizzleSelectFn })
```

#### Methods

- `getEntitlements(planId: string): Promise<EntitlementRule[]>` - 플랜의 모든 entitlement 조회
- `findRule(planId: string, featureKey: string): Promise<EntitlementRule | null>` - 특정 기능의 entitlement 조회

### BillingStoreSubscriptionProvider

`SubscriptionProvider` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(billingStore: BillingStore)
```

#### Methods

- `getCurrentPlanId(tenantId: string): Promise<string | null>` - 테넌트의 현재 플랜 ID 조회

### Schema

- `planEntitlements` - entitlement 정의 테이블

## 타입

```typescript
type EntitlementRule = {
  featureKey: string;
  type: 'boolean' | 'metered' | 'static';
  value?: number;
  meterId?: string;
  quota?: number;
  overagePolicy?: 'BLOCK' | 'WARN' | 'ALLOW_WITH_OVERAGE';
};
```

## 테스트

```bash
pnpm test --filter=@croco/entitlements-drizzle
```

## 라이선스

MIT

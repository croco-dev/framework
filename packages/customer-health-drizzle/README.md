# @croco/customer-health-drizzle

@croco/customer-health-core의 Drizzle ORM 기반 구현체입니다.

## 개요

`customer-health-drizzle`은 테넌트 건강 점수 데이터를 PostgreSQL에 저장하고, Billing/Metering 시스템과 연동하여 신호를 수집하는 Drizzle ORM 구현체를 제공합니다.

## 설치

```bash
pnpm add @croco/customer-health-drizzle @croco/customer-health-core drizzle-orm
```

## 데이터베이스 스키마

```sql
CREATE TABLE tenant_health_scores (
  tenant_id TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'at_risk', 'critical')),
  category_scores JSONB NOT NULL,
  signals JSONB NOT NULL,
  trend TEXT NOT NULL CHECK (trend IN ('improving', 'stable', 'declining')),
  previous_score INTEGER,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_scores_tenant_id ON tenant_health_scores(tenant_id);
CREATE INDEX idx_health_scores_calculated_at ON tenant_health_scores(calculated_at);
```

## 사용법

### DrizzleHealthScoreStore

```typescript
import { 
  DrizzleHealthScoreStore, 
  DRIZZLE_TOKEN 
} from '@croco/customer-health-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const store = new DrizzleHealthScoreStore(db);

// 점수 저장
await store.save({
  tenantId: 'tenant-1',
  overallScore: 85,
  status: 'healthy',
  categoryScores: { usage: 90, business: 80, engagement: 85 },
  signals: [...],
  trend: 'stable',
  calculatedAt: new Date(),
});

// 최신 점수 조회
const latest = await store.findLatest('tenant-1');

// 히스토리 조회
const history = await store.findHistory('tenant-1', 10);

// 기간별 조회
const periodData = await store.findHistoryByPeriod(
  'tenant-1',
  'month',
  new Date('2026-01-01'),
  new Date('2026-01-31')
);
```

### DrizzleHealthSignalRegistry

```typescript
import { DrizzleHealthSignalRegistry } from '@croco/customer-health-drizzle';

const registry = new DrizzleHealthSignalRegistry(
  meteringProvider,
  billingProvider
);

const providers = registry.getProviders();
```

### BillingSignalProvider

구독 상태를 기반으로 비즈니스 신호를 수집합니다.

```typescript
import { 
  BillingSignalProvider,
  SUBSCRIPTION_STORAGE_TOKEN 
} from '@croco/customer-health-drizzle';

const provider = new BillingSignalProvider(subscriptionStorage);

// 구독 저장소 인터페이스
interface SubscriptionStorage {
  getSubscription(tenantId: string): Promise<SubscriptionData | null>;
}

const signals = await provider.collect('tenant-1');
```

**구독 상태 점수 매핑:**

| 상태 | 점수 |
|-----|------|
| `active` | 100 |
| `trialing` | 80 |
| `past_due` | 30 |
| `canceled` | 0 |

### MeteringSignalProvider

사용량 데이터를 기반으로 usage 신호를 수집합니다.

```typescript
import { 
  MeteringSignalProvider,
  USAGE_STORAGE_TOKEN 
} from '@croco/customer-health-drizzle';

const provider = new MeteringSignalProvider(usageStorage);

// 사용량 저장소 인터페이스
interface UsageStorage {
  getUsage(
    tenantId: string, 
    periodStart: Date, 
    periodEnd: Date
  ): Promise<UsageData>;
}

const signals = await provider.collect('tenant-1');
```

### DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject, Token } from '@croco/framework-context';
import { 
  CustomerHealthService,
  HealthScoreStore,
  HealthSignalRegistry 
} from '@croco/customer-health-core';
import { 
  DrizzleHealthScoreStore,
  DrizzleHealthSignalRegistry,
  MeteringSignalProvider,
  BillingSignalProvider,
  DRIZZLE_TOKEN 
} from '@croco/customer-health-drizzle';

const DRIZZLE_DB_TOKEN = 'DRIZZLE_DB_TOKEN';

Container.set(DRIZZLE_TOKEN, db);
Container.set(HealthScoreStore.token, DrizzleHealthScoreStore);
Container.set(HealthSignalRegistry.token, DrizzleHealthSignalRegistry);
Container.set(MeteringSignalProvider, { factory: () => new MeteringSignalProvider(usageStorage) });
Container.set(BillingSignalProvider, { factory: () => new BillingSignalProvider(billingStorage) });

@Component()
class HealthService {
  constructor(
    @Inject(CustomerHealthService) private healthService: CustomerHealthService
  ) {}

  async calculateTenantHealth(tenantId: string) {
    return await this.healthService.calculateAndStore(tenantId, {
      id: 'default',
      name: 'Default Profile',
      weights: { usage: 0.4, business: 0.4, engagement: 0.2 },
      thresholds: { healthy: 80, atRisk: 60 },
    });
  }
}
```

## API

### DrizzleHealthScoreStore

`HealthScoreStore` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(db: DrizzleHealthClient)
```

#### Methods

- `save(score: TenantHealthScore): Promise<void>` - 점수 저장
- `findLatest(tenantId: string): Promise<TenantHealthScore | null>` - 최신 점수 조회
- `findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]>` - 히스토리 조회
- `findHistoryByPeriod(tenantId, period, startDate, endDate): Promise<TenantHealthScore[]>` - 기간별 조회

### DrizzleHealthSignalRegistry

`HealthSignalRegistry`의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(
  meteringProvider: MeteringSignalProvider,
  billingProvider: BillingSignalProvider
)
```

### BillingSignalProvider

구독 정보를 수집하여 비즈니스 신호를 생성합니다.

#### Constructor

```typescript
constructor(
  @Inject(SUBSCRIPTION_STORAGE_TOKEN) subscriptionStorage: SubscriptionStorage
)
```

#### Types

```typescript
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

type SubscriptionData = {
  tenantId: string;
  status: SubscriptionStatus;
  planId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

interface SubscriptionStorage {
  getSubscription(tenantId: string): Promise<SubscriptionData | null>;
}
```

### MeteringSignalProvider

사용량 정보를 수집하여 usage 신호를 생성합니다.

#### Constructor

```typescript
constructor(
  @Inject(USAGE_STORAGE_TOKEN) usageStorage: UsageStorage
)
```

#### Types

```typescript
type UsageData = {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  usage: number;
  limit: number;
  features: Array<{
    key: string;
    usage: number;
    limit: number;
  }>;
};

interface UsageStorage {
  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<UsageData>;
}
```

### Schema

- `tenantHealthScores` - 건강 점수 저장 테이블

## 테스트

```bash
pnpm test --filter=@croco/customer-health-drizzle
```

## 라이선스

MIT

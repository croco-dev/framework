# @croco/customer-health-drizzle

`@croco/customer-health-core`용 Drizzle 구현체입니다.

## 설치

```bash
pnpm add @croco/customer-health-drizzle @croco/customer-health-core drizzle-orm
```

## 사용법

```typescript
import {
  BillingSignalProvider,
  DrizzleHealthScoreStore,
  DrizzleHealthSignalRegistry,
  MeteringSignalProvider,
} from "@croco/customer-health-drizzle";

const scoreStore = new DrizzleHealthScoreStore(db);
const usageProvider = new MeteringSignalProvider(usageStorage);
const billingProvider = new BillingSignalProvider(subscriptionStorage);
const registry = new DrizzleHealthSignalRegistry(usageProvider, billingProvider);

await scoreStore.save({
  tenantId: "tenant-1",
  overallScore: 85,
  status: "healthy",
  categoryScores: { usage: 90, business: 80, engagement: 85 },
  signals: [],
  trend: "stable",
  calculatedAt: new Date(),
});

const latest = await scoreStore.findLatest("tenant-1");
const providers = registry.getProviders();
```

## API 레퍼런스

### `DrizzleHealthScoreStore`

- `save(score)`, 건강 점수 스냅샷을 저장합니다.
- `findLatest(tenantId)`, 최신 건강 점수를 조회합니다.
- `findHistory(tenantId, limit)`, 최근 점수 이력을 조회합니다.
- `findHistoryByPeriod(tenantId, period, startDate, endDate)`, 기간별 이력을 조회합니다.

### 신호 제공자

- `BillingSignalProvider`, 구독 상태를 business 신호로 변환합니다.
- `MeteringSignalProvider`, 사용량 데이터를 usage 신호로 변환합니다.
- `DrizzleHealthSignalRegistry`, 기본 신호 제공자 목록을 반환합니다.

### 타입과 스키마

- `SubscriptionStatus`, `SubscriptionData`, `SubscriptionStorage`, 구독 신호 타입입니다.
- `UsageData`, `UsageStorage`, 사용량 신호 타입입니다.
- `DRIZZLE_TOKEN`, 건강 점수 저장소용 DB 토큰입니다.
- `SUBSCRIPTION_STORAGE_TOKEN`, `USAGE_STORAGE_TOKEN`, 보조 저장소 토큰입니다.
- `tenantHealthScores`, 건강 점수 스키마입니다.

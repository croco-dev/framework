# @croco/metrics-core

SaaS 비즈니스를 위한 핵심 메트릭 계산 및 스냅샷 관리 라이브러리입니다.

## 설치

```bash
pnpm add @croco/metrics-core
```

## 주요 기능

### MetricsEngine

모든 메트릭 계산을 통합하는 메인 엔진입니다.

```ts
import { MetricsEngine, TimescaleMetricsStore } from '@croco/metrics-core';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool);
const store = new TimescaleMetricsStore(db);
const engine = new MetricsEngine(store);

const metrics = await engine.calculateAll({
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
});
```

### 지원하는 메트릭

| 메트릭 | 설명 |
|--------|------|
| **MRR** | Monthly Recurring Revenue (월 반복 수익) |
| **Churn Rate** | 고객 이탈률 (월 기준) |
| **Logo Churn** | 고객 수 기반 이탈률 |
| **NRR** | Net Revenue Retention (순 수익 유지율) |
| **GRR** | Gross Revenue Retention (총 수익 유지율) |
| **Quick Ratio** | 신규 MRR / 이탈 MRR 비율 |
| **Growth Rate** | MRR 성장률 |
| **Carrying Capacity** | 수용 가능한 신규 고객 수 |
| **LTV** | Customer Lifetime Value (고객 생애 가치) |

### RetentionCalculator

리텐션 메트릭(GRR, NRR, Logo Churn, Revenue Churn)을 계산합니다.

```ts
import { RetentionCalculator } from '@croco/metrics-core';

const calculator = new RetentionCalculator();

// 개별 메트릭 계산
const grr = await calculator.calculateGRR(startingMRR, movement);
const nrr = await calculator.calculateNRR(startingMRR, movement);
const logoChurn = await calculator.calculateLogoChurn(100, 95); // 5% 이탈

// 전체 리텐션 메트릭 한 번에 계산
const retention = await calculator.calculateRetention(
  startingMRR,
  movement,
  startingCustomers,  // optional: Logo Churn 계산용
  endingCustomers     // optional: Logo Churn 계산용
);
```

### CarryingCapacityCalculator

Carrying Capacity는 현재 팀/인프라가 감당할 수 있는 최대 고객 수를 계산합니다.

- **Revenue 기반**: 현재 MRR 목표로 유지할 수 있는 고객 수
- **User 기반**: 온보딩 capacity를 고려한 고객 수
- **시뮬레이션**: 다양한 시나리오(성장률, 온보딩 팀 규모)로 미래 예측

```ts
import { CarryingCapacityCalculator } from '@croco/metrics-core';

const calculator = new CarryingCapacityCalculator();

// Revenue 기반 계산
const revenueCC = await calculator.calculateByRevenue(config, {
  targetMrr: { amount: 50000, currency: 'USD' },
  arpu: { amount: 500, currency: 'USD' },
});

// User 기반 계산
const userCC = await calculator.calculateByUser(config, {
  onboardingTeamSize: 5,
  onboardingPerMonth: 10,
});

// 시뮬레이션
const simulation = await calculator.simulate(config, {
  months: 12,
  monthlyGrowthRate: 0.05,
});
```

### SnapshotScheduler

정기적으로 메트릭 스냅샷을 생성하고 저장합니다.

```ts
import { SnapshotScheduler, MetricsEngine } from '@croco/metrics-core';

const scheduler = new SnapshotScheduler(engine, store, {
  retentionDays: 365,
});

// 매월 1일 스냅샷 생성
await scheduler.scheduleMonthly();
```

## API

### Types

```ts
type Money = {
  amount: number;
  currency: string;
};

type Period = {
  start: string;  // ISO date
  end: string;    // ISO date
};

type Percentage = {
  value: number;
  formatted: string;
};

type MetricsSnapshot = {
  period: Period;
  mrr: Money;
  churnRate: Percentage;
  netRevenueRetention: Percentage;
  quickRatio: number;
  growthMetrics: GrowthMetrics;
  customerMetrics: CustomerMetrics;
  retentionMetrics: RetentionMetrics;
};
```

### MetricsEngine

```ts
class MetricsEngine {
  async calculateAll(options: {
    startDate: Date;
    endDate: Date;
  }): Promise<MetricsSnapshot>;
}
```

### TimescaleMetricsStore

```ts
class TimescaleMetricsStore implements MetricsRepository {
  constructor(client: PostgresClient);

  async saveSnapshot(snapshot: MetricsSnapshot): Promise<void>;
  async getSnapshot(period: Period): Promise<MetricsSnapshot | null>;
  async findSnapshotsInRange(start: Date, end: Date): Promise<MetricsSnapshot[]>;
}
```

## Dependencies

- `@croco/events-core` - 이벤트 기반 아키텍처
- `@croco/framework-context` - DI 컨테이너
- `drizzle-orm` - DB ORM

## Billing 연동

billing 도메인 이벤트를 metrics 흐름으로 연결하는 구현체는 `@croco/metrics-billing` 패키지에서 제공합니다.

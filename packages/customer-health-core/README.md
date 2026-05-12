# @croco/customer-health-core

테넌트 건강 점수(Tenant Health Score) 시스템의 핵심 인터페이스와 구현을 제공합니다.

## 개요

`customer-health-core`는 SaaS 테넌트의 건강 상태를 측정하고 추적하는 도메인 로직을 담당합니다. 다양한 신호(Signal)를 수집하여 가중 평균으로 건강 점수를 계산하고, 상태 변화에 따른 이벤트를 발행합니다.

## 설치

```bash
pnpm add @croco/customer-health-core @croco/framework-context @croco/events-core @croco/problems-core
```

## 핵심 개념

### 건강 점수(Health Score)

0-100 사이의 점수로 테넌트의 전반적인 건강 상태를 표현합니다:

- **healthy (80-100)**: 건강한 상태
- **at_risk (60-79)**: 위험 상태
- **critical (0-59)**: 심각한 상태

### 신호 카테고리(Signal Category)

| 카테고리     | 설명          | 예시 신호              |
| ------------ | ------------- | ---------------------- |
| `usage`      | 사용량 관련   | API 호출, 기능 사용률  |
| `business`   | 비즈니스 관련 | 구독 상태, MRR         |
| `engagement` | 참여도 관련   | 로그인 빈도, 세션 시간 |

### 내장 신호(Builtin Signals)

```typescript
import type {
  LoginFrequencySignal,
  FeatureUsageRateSignal,
  SupportTicketFrequencySignal,
} from "@croco/customer-health-core";

// 로그인 빈도
const loginSignal: LoginFrequencySignal = {
  type: "login_frequency",
  loginsPerDay: 5.2,
  activeDays: 20,
  totalDays: 30,
};

// 기능 사용률
const featureSignal: FeatureUsageRateSignal = {
  type: "feature_usage_rate",
  featureKey: "reports",
  usageCount: 150,
  uniqueUsers: 10,
};

// 지원 티켓 빈도
const ticketSignal: SupportTicketFrequencySignal = {
  type: "support_ticket_frequency",
  openTickets: 3,
  resolvedTickets: 12,
  avgResolutionTime: 86400, // seconds
  ticketsPerUser: 0.5,
};
```

## 사용법

### 기본 사용

```typescript
import {
  CustomerHealthService,
  HealthScoreCalculator,
  InMemoryHealthScoreStore,
  SignalProvider,
} from "@croco/customer-health-core";

// 신호 제공자 구현
class MySignalProvider extends SignalProvider {
  readonly category = "usage";

  async collect(tenantId: string): Promise<HealthSignal[]> {
    return [
      {
        category: "usage",
        name: "api_calls",
        value: 80,
        weight: 1.0,
        rawValue: { count: 8000 },
        collectedAt: new Date(),
      },
    ];
  }
}

// 서비스 초기화
const calculator = new HealthScoreCalculator();
const store = new InMemoryHealthScoreStore();
const signalRegistry = new MySignalRegistry();
const service = new CustomerHealthService(signalRegistry, store, calculator);

// 건강 점수 계산
const profile: HealthScoreProfile = {
  id: "default",
  name: "Default Profile",
  weights: { usage: 0.4, business: 0.4, engagement: 0.2 },
  thresholds: { healthy: 80, atRisk: 60 },
};

const score = await service.calculateAndStore("tenant-1", profile);
```

### 추세 분석

```typescript
import type { TrendPeriod, HealthTrendAnalysis } from "@croco/customer-health-core";

// 추세 조회 (최근 30일)
const trend = await service.getTrend("tenant-1", 30);

// 특정 기간의 상세 분석
const analysis: HealthTrendAnalysis = await trendAnalyzer.analyzeTrend(
  "tenant-1",
  "month" as TrendPeriod,
  new Date("2026-01-01"),
  new Date("2026-01-31"),
);

console.log(analysis);
// {
//   tenantId: 'tenant-1',
//   period: 'month',
//   startDate: Date,
//   endDate: Date,
//   dataPoints: [...],
//   averageScore: 75.5,
//   trendDirection: 'improving',
//   changePercentage: 12.5
// }
```

### 이벤트 처리

```typescript
import { HealthStatusChangedEvent, HealthScoreDroppedEvent } from "@croco/customer-health-core";

// 상태 변경 이벤트
@RegisterEventHandler(HealthStatusChangedEvent)
class StatusChangeHandler {
  async handle(event: HealthStatusChangedEvent) {
    if (event.newStatus === "critical") {
      await notifyCustomerSuccess(event.tenantId);
    }
  }
}

// 점수 급락 이벤트
@RegisterEventHandler(HealthScoreDroppedEvent)
class ScoreDropHandler {
  async handle(event: HealthScoreDroppedEvent) {
    if (event.dropPercentage >= 30) {
      await escalateAlert(event.tenantId);
    }
  }
}
```

### DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject, Token } from "@croco/framework-context";
import {
  CustomerHealthService,
  HealthSignalRegistry,
  HealthScoreStore,
} from "@croco/customer-health-core";

Container.set(HealthSignalRegistry.token, myRegistry);
Container.set(HealthScoreStore.token, myStore);
Container.register(CustomerHealthService, "singleton");

@Component()
class MyService {
  constructor(@Inject(CustomerHealthService) private healthService: CustomerHealthService) {}
}
```

## API

### CustomerHealthService

건강 점수 계산과 이벤트 발행의 메인 서비스입니다.

#### Methods

- `calculateAndStore(tenantId: string, profile: HealthScoreProfile): Promise<TenantHealthScore>` - 신호 수집 및 점수 계산
- `getLatest(tenantId: string): Promise<TenantHealthScore | null>` - 최신 점수 조회
- `getTrend(tenantId: string, days: number): Promise<{ trend: HealthTrend; changePercentage: number } | null>` - 추세 분석

### HealthScoreCalculator

신호를 기반으로 건강 점수를 계산합니다.

#### Methods

- `calculate(signals: HealthSignal[], profile: HealthScoreProfile): TenantHealthScore` - 점수 계산
- `determineTrend(currentScore: number, previousScore?: number): HealthTrend` - 추세 방향 결정

### InMemoryHealthScoreStore

인메모리 저장소 구현체입니다. 테스트나 개발 환경에 적합합니다.

### 인터페이스

#### SignalProvider

```typescript
abstract class SignalProvider {
  abstract readonly category: SignalCategory;
  abstract collect(tenantId: string): Promise<HealthSignal[]>;
}
```

#### HealthScoreStore

```typescript
abstract class HealthScoreStore {
  abstract save(score: TenantHealthScore): Promise<void>;
  abstract findLatest(tenantId: string): Promise<TenantHealthScore | null>;
  abstract findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]>;
  abstract findHistoryByPeriod(
    tenantId: string,
    period: TrendPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<TenantHealthScore[]>;
}
```

#### TrendAnalyzer

```typescript
abstract class TrendAnalyzer {
  abstract analyzeTrend(
    tenantId: string,
    period: TrendPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<HealthTrendAnalysis>;
}
```

## 타입

```typescript
// 건강 상태
type HealthStatus = "healthy" | "at_risk" | "critical";

// 추세 방향
type HealthTrend = "improving" | "stable" | "declining";

// 추세 기간
type TrendPeriod = "day" | "week" | "month";

// 건강 신호
type HealthSignal = {
  category: SignalCategory;
  name: string;
  value: number;
  weight: number;
  rawValue: unknown;
  collectedAt: Date;
};

// 건강 점수 프로필
type HealthScoreProfile = {
  id: string;
  name: string;
  weights: Record<SignalCategory, number>;
  thresholds: { healthy: number; atRisk: number };
};

// 테넌트 건강 점수
type TenantHealthScore = {
  tenantId: string;
  overallScore: number;
  status: HealthStatus;
  categoryScores: Record<SignalCategory, number>;
  signals: HealthSignal[];
  trend: HealthTrend;
  previousScore?: number;
  calculatedAt: Date;
};

// 추세 분석
type HealthTrendAnalysis = {
  tenantId: string;
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  dataPoints: TrendDataPoint[];
  averageScore: number;
  trendDirection: HealthTrend;
  changePercentage: number;
};
```

## 테스트

```bash
pnpm test --filter=@croco/customer-health-core
```

## 라이선스

MIT

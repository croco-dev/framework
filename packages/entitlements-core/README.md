# @croco/entitlements-core

플랜 entitlement와 quota 강제를 담당하는 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/entitlements-core
```

## 핵심 기능

- Boolean, Static, Metered entitlement 지원
- 플랜별 entitlement 규칙 조회
- quota 초과 시 BLOCK, WARN, ALLOW_WITH_OVERAGE 정책 적용
- 사용량 조회, 리셋, 히스토리 조회를 위한 추상 인터페이스 제공
- entitlement quota 초과 및 overage 허용 이벤트 발행 지원

## 빠른 시작

```typescript
import {
  EntitlementManager,
  EntitlementEventPublisher,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  InMemoryPlanEntitlementRegistry,
  StaticSubscriptionProvider,
  type EntitlementQuotaStatus,
  type UsageHistoryEntry,
  type UsageHistoryPeriod,
} from '@croco/entitlements-core';
import { Container } from '@croco/framework-context';

class InMemoryQuotaChecker extends EntitlementQuotaChecker {
  async checkQuota(_tenantId: string, _featureId: string, quota: number): Promise<EntitlementQuotaStatus> {
    return {
      usage: 20,
      quota,
      exceeded: false,
      remaining: quota - 20,
    };
  }

  async getCurrentUsage(): Promise<number> {
    return 20;
  }

  async resetUsage(): Promise<void> {}

  async getUsageHistory(_tenantId: string, _featureId: string, _period: UsageHistoryPeriod): Promise<UsageHistoryEntry[]> {
    return [];
  }
}

class StaticMeterLookup extends EntitlementMeterLookup {
  async getMeterQuota(): Promise<number | null> {
    return 100;
  }
}

class NoopEventPublisher extends EntitlementEventPublisher {
  async publish(): Promise<void> {}
}

const registry = new InMemoryPlanEntitlementRegistry();
registry.register('pro', [
  {
    featureKey: 'api_calls',
    type: 'metered',
    quota: 100,
    overagePolicy: 'BLOCK',
  },
]);

Container.set(EntitlementEventPublisher.token, new NoopEventPublisher());

const manager = new EntitlementManager(
  registry,
  new StaticSubscriptionProvider('pro'),
  new InMemoryQuotaChecker(),
  new StaticMeterLookup()
);

const result = await manager.check('tenant-1', 'api_calls');
```

## OveragePolicy

### BLOCK

- quota 초과 시 `granted: false`
- `reason: 'quota_exceeded'` 반환
- `EntitlementQuotaExceededEvent` 발행

### WARN

- quota 초과 시 경고 로그 출력
- 요청은 계속 허용
- `EntitlementQuotaExceededEvent` 발행

### ALLOW_WITH_OVERAGE

- quota 초과 시 요청 허용
- `EntitlementQuotaExceededEvent` 발행
- `EntitlementOverageAllowedEvent` 발행

## 사용자 구현 인터페이스

### EntitlementQuotaChecker

- `checkQuota(tenantId, featureId, quota)`
- `getCurrentUsage(tenantId, featureId)`
- `resetUsage(tenantId, featureId, billingCycleStart)`
- `getUsageHistory(tenantId, featureId, period)`

### EntitlementMeterLookup

- `getMeterQuota(tenantId, meterId)`

### SubscriptionProvider

- `getCurrentPlanId(tenantId)`

### EntitlementEventPublisher

- `publish(event)`

## 이벤트

- `EntitlementDeniedEvent`
- `EntitlementQuotaExceededEvent`
- `EntitlementOverageAllowedEvent`

## 테스트

```bash
pnpm test --filter=@croco/entitlements-core
pnpm typecheck --filter=@croco/entitlements-core
```

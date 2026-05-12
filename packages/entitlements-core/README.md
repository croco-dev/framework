# @croco/entitlements-core

플랜별 entitlement와 quota 강제를 제공하는 SaaS 기능 제한 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/entitlements-core
```

## 사용법

```ts
import {
  EntitlementManager,
  InMemoryPlanEntitlementRegistry,
  StaticSubscriptionProvider,
} from "@croco/entitlements-core";

const registry = new InMemoryPlanEntitlementRegistry();
registry.register("pro", [
  {
    featureKey: "api_calls",
    type: "metered",
    quota: 100,
    overagePolicy: "BLOCK",
  },
]);

const manager = new EntitlementManager(
  registry,
  new StaticSubscriptionProvider("pro"),
  quotaChecker,
  meterLookup,
);

const result = await manager.check("tenant-1", "api_calls");
```

## API 레퍼런스

### 핵심 클래스

- `EntitlementManager`, 플랜 조회와 quota 검사를 조합해 entitlement 결과를 반환합니다.
- `EntitlementGuard`, 라우트 단위 entitlement 강제를 담당합니다.
- `InMemoryPlanEntitlementRegistry`, 테스트용 플랜 규칙 저장소입니다.
- `StaticSubscriptionProvider`, 고정 플랜 기반 구독 제공자입니다.

### 데코레이터와 인터페이스

- `@RequireEntitlement`, 엔드포인트에 필요한 기능 키를 선언합니다.
- `SubscriptionProvider`, `PlanEntitlementRegistry`, `EntitlementQuotaChecker`, `EntitlementMeterLookup`, `EntitlementEventPublisher`

### 주요 타입

- `EntitlementRule`, `EntitlementCheckResult`, `EntitlementQuotaStatus`
- `EntitlementType`, `OveragePolicy`, `PlanEntitlements`
- `UsageHistoryEntry`, `UsageHistoryPeriod`

### 이벤트와 문제 타입

- 이벤트: `EntitlementDeniedEvent`, `EntitlementQuotaExceededEvent`, `EntitlementOverageAllowedEvent`
- 문제 타입: `EntitlementDeniedProblem`, `EntitlementNotFoundProblem`

## 구현 포인트

- `BLOCK`, `WARN`, `ALLOW_WITH_OVERAGE` 세 가지 overage 정책을 지원합니다.
- `meterId`를 지정하면 metering-core의 실제 사용량과 quota를 연결할 수 있습니다.
- subscription, billing, membership 같은 패키지와 조합해 플랜 제한을 중앙에서 관리할 수 있습니다.

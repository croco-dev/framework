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

### 라우트와 서비스 경계 강제

`@RequireEntitlement`는 클래스나 메서드에 필요한 기능 키를 선언합니다. `EntitlementGuard`는 핸들러 실행 전에 tenant, user, route, resource를 명시적인 guard 입력으로 만들어 `EntitlementManager.check()`를 호출하고, 실패 시 표준 Problem을 throw합니다.

```ts
import { EntitlementGuard, RequireEntitlement } from "@croco/entitlements-core";

class ReportsController {
  @RequireEntitlement({
    feature: "reports.export",
    resource: { type: "report", idParam: "reportId" },
  })
  exportReport() {
    return "ok";
  }
}
```

resource id는 `resource.id`로 고정하거나 `resource.idParam`을 통해 request params에서 가져올 수 있습니다. guard는 성공과 실패 모두 `entitlement.guard.allowed` / `entitlement.guard.denied` telemetry event를 남기며, `EntitlementAuditSink`를 컨테이너에 등록하면 동일한 evidence를 audit sink로 받을 수 있습니다.

## API 레퍼런스

### 핵심 클래스

- `EntitlementManager`, 플랜 조회와 quota 검사를 조합해 entitlement 결과를 반환합니다.
- `EntitlementGuard`, 라우트 단위 entitlement 강제를 담당합니다.
- `InMemoryPlanEntitlementRegistry`, 테스트용 플랜 규칙 저장소입니다.
- `StaticSubscriptionProvider`, 고정 플랜 기반 구독 제공자입니다.

### 데코레이터와 인터페이스

- `@RequireEntitlement`, 클래스나 메서드에 필요한 기능 키와 resource 요구사항을 선언합니다.
- `SubscriptionProvider`, `PlanEntitlementRegistry`, `EntitlementQuotaChecker`, `EntitlementMeterLookup`, `EntitlementEventPublisher`
- `EntitlementAuditSink`, guard 허용/거부 evidence를 기록하는 audit sink입니다.

### 주요 타입

- `EntitlementRule`, `EntitlementCheckResult`, `EntitlementQuotaStatus`
- `EntitlementCheckStatus`, `EntitlementType`, `OveragePolicy`, `PlanEntitlements`
- `EntitlementRequirement`, `EntitlementResourceRequirement`, `EntitlementGuardInput`
- `UsageHistoryEntry`, `UsageHistoryPeriod`

### 이벤트와 문제 타입

- 이벤트: `EntitlementDeniedEvent`, `EntitlementQuotaExceededEvent`, `EntitlementOverageAllowedEvent`
- 문제 타입: `EntitlementDeniedProblem`, `EntitlementMissingPlanProblem`, `EntitlementInactiveSubscriptionProblem`, `EntitlementQuotaExceededProblem`, `EntitlementProviderUnavailableProblem`, `EntitlementNotFoundProblem`

## Contract artifacts

`@RequireEntitlement` metadata는 `ENTITLEMENT_REQUIREMENTS_KEY`로 저장되며 `@croco/protocols-core`의 contract graph snapshot에 포함됩니다. `@croco/openapi-spec`는 선언된 entitlement 요구사항을 operation-level `x-croco-entitlements` extension으로 내보냅니다. 이 필드는 OpenAPI/RPC consumer coverage에서 drift gate로 검사됩니다.

## 구현 포인트

- `BLOCK`, `WARN`, `ALLOW_WITH_OVERAGE` 세 가지 overage 정책을 지원합니다.
- `EntitlementCheckResult.status`는 `allowed`, `denied`, `soft-limit`, `overage-allowed`, `unknown` 상태를 사용해 guard/audit/telemetry evidence를 정규화합니다.
- `meterId`를 지정하면 metering-core의 실제 사용량과 quota를 연결할 수 있습니다.
- subscription, billing, membership 같은 패키지와 조합해 플랜 제한을 중앙에서 관리할 수 있습니다.

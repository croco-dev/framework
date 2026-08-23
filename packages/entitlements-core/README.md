# @croco/entitlements-core

플랜별 entitlement와 quota 강제를 제공하는 SaaS 기능 제한 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/entitlements-core
```

## 사용법

```ts
import {
  defineFeature,
  definePlanEntitlements,
  EntitlementManager,
  InMemoryPlanEntitlementRegistry,
  StaticSubscriptionProvider,
} from "@croco/entitlements-core";
import { planVersionRef } from "@croco/billing-core";
import { defineMeter } from "@croco/metering-core";

const API_CALLS = defineFeature("api_calls");
const API_CALL_METER = defineMeter({
  key: "api.calls",
  aggregation: "COUNT",
  unit: "request",
  billing: "required",
});
const PRO_2026_01 = planVersionRef("pro@2026-01");
const registry = new InMemoryPlanEntitlementRegistry();
registry.register(
  definePlanEntitlements({
    planId: "pro",
    planVersionRef: PRO_2026_01,
    entitlements: [
      {
        feature: API_CALLS,
        type: "metered",
        meter: API_CALL_METER,
        quota: 100,
        overagePolicy: "ALLOW_WITH_OVERAGE",
      },
    ],
  }),
);

const manager = new EntitlementManager(
  registry,
  new StaticSubscriptionProvider({
    planId: "pro",
    planVersionRef: PRO_2026_01,
  }),
  quotaChecker,
  meterLookup,
);

const result = await manager.check("tenant-1", API_CALLS);
```

### 라우트와 서비스 경계 강제

`@RequireEntitlement`는 클래스나 메서드에 필요한 기능 키를 선언합니다. `EntitlementGuard`는 핸들러 실행 전에 tenant, user, route, resource를 명시적인 guard 입력으로 만들어 `EntitlementManager.check()`를 호출하고, 실패 시 표준 Problem을 throw합니다.

```ts
import { defineFeature, EntitlementGuard, RequireEntitlement } from "@croco/entitlements-core";

const REPORT_EXPORT = defineFeature("reports.export");
class ReportsController {
  @RequireEntitlement({
    feature: REPORT_EXPORT,
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
- `assertEntitlementRules`, provider와 registry 경계에서 중복 및 공통 semantic invariant를 검증합니다. Legacy metered rule의 meter-derived quota는 허용합니다.

### 데코레이터와 인터페이스

- `@RequireEntitlement`, 클래스나 메서드에 필요한 기능 키와 resource 요구사항을 선언합니다.
- `SubscriptionProvider`, `PlanEntitlementRegistry`, `EntitlementQuotaChecker`, `EntitlementMeterLookup`, `EntitlementEventPublisher`
- `EntitlementAuditSink`, guard 허용/거부 evidence를 기록하는 audit sink입니다.

### 주요 타입

- `EntitlementRule`, `EntitlementCheckResult`, `EntitlementQuotaStatus`
- `EntitlementCheckStatus`, `EntitlementType`, `OveragePolicy`, `PlanEntitlements`
- `FeatureRef`, `EntitlementDefinition`, `PlanEntitlementDefinition`, `SubscriptionPlanReference`
- `EntitlementRequirement`, `EntitlementResourceRequirement`, `EntitlementGuardInput`
- `UsageHistoryEntry`, `UsageHistoryPeriod`

### 이벤트와 문제 타입

- 이벤트: `EntitlementDeniedEvent`, `EntitlementQuotaExceededEvent`, `EntitlementOverageAllowedEvent`
- 문제 타입: `EntitlementDeniedProblem`, `EntitlementMissingPlanProblem`, `EntitlementInactiveSubscriptionProblem`, `EntitlementQuotaExceededProblem`, `EntitlementProviderUnavailableProblem`, `EntitlementNotFoundProblem`, `EntitlementPlanVersionNotFoundProblem`

## Contract artifacts

`@RequireEntitlement` metadata는 `ENTITLEMENT_REQUIREMENTS_KEY`로 저장되며 `@croco/protocols-core`의 contract graph snapshot에 포함됩니다. `@croco/openapi-spec`는 선언된 entitlement 요구사항을 operation-level `x-croco-entitlements` extension으로 내보냅니다. 이 필드는 OpenAPI/RPC consumer coverage에서 drift gate로 검사됩니다.

## 구현 포인트

- `BLOCK`, `WARN`, `ALLOW_WITH_OVERAGE` 세 가지 overage 정책을 지원합니다.
- entitlement set은 `PlanVersionRef`로 등록하고 subscription의 같은 immutable reference로 조회합니다. 알 수 없는 reference는 최신 플랜으로 fallback하지 않고 `entitlements-core/plan-version-not-found` Problem으로 실패합니다.
- version-bound metered rule은 quota를 definition에 직접 고정합니다. 외부의 현재 meter quota로 fallback하는 동적 quota는 legacy plan-ID 경로에서만 지원합니다.
- `ALLOW_WITH_OVERAGE` canonical definition은 `billing: "required"`인 typed `MeterRef`를 요구합니다.
- 정규화된 rule은 `meterId`와 `meterBilling`을 함께 보존하므로 persistent adapter와 후속 verification도 billable binding을 검사할 수 있습니다.
- `EntitlementCheckResult.status`는 `allowed`, `denied`, `soft-limit`, `overage-allowed`, `unknown` 상태를 사용해 guard/audit/telemetry evidence를 정규화합니다.
- `meterId`를 지정하면 metering-core의 실제 사용량과 quota를 연결할 수 있습니다.
- subscription, billing, membership 같은 패키지와 조합해 플랜 제한을 중앙에서 관리할 수 있습니다.

## 기존 plan-ID registry 마이그레이션

기존 `registry.register(planId, rules)`와 문자열 `StaticSubscriptionProvider(planId)`는 source compatibility를 위해 유지되며, 둘 다 결정적인 `legacy:<planId>` reference만 사용합니다. 이 경로는 최신 버전을 추정하지 않습니다.

운영 데이터는 다음 순서로 옮깁니다.

1. billing registry에서 대상 subscription에 적용할 정확한 published `PlanVersionRef`를 선택합니다.
2. `migrateLegacyPlanEntitlements({ planId, entitlements }, selectedRef)`로 entitlement set을 변환합니다. `legacy:` reference는 거부됩니다.
3. 변환된 set을 등록한 뒤 subscription의 `planVersionRef`를 같은 값으로 backfill합니다.
4. 모든 subscription과 entitlement set이 고정된 뒤 legacy plan-ID 등록을 제거합니다.

자동으로 최신 plan version을 선택하는 migration은 지원하지 않습니다.

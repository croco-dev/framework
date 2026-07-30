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
} from "@croco/entitlements-drizzle";
import { Container } from "@croco/framework-context";

Container.set(DRIZZLE_TOKEN, db);
Container.set(BILLING_STORE_TOKEN, billingStore);

const registry = new DrizzlePlanEntitlementRegistry(db);
const provider = new BillingStoreSubscriptionProvider(billingStore);

const plan = await provider.getCurrentPlanVersion("tenant-123");
const entitlements = plan
  ? await registry.getEntitlementsByPlanVersion(plan.planVersionRef, plan.planId)
  : [];
```

## API 레퍼런스

### DrizzlePlanEntitlementRegistry

- `getEntitlements(planId)`, migration 중인 null-version legacy 규칙만 반환합니다.
- `findRule(planId, featureKey)`, migration 중인 null-version legacy 규칙 하나를 반환합니다.
- `getEntitlementsByPlanVersion(planVersionRef, expectedPlanId?)`, 고정된 버전의 모든 규칙을 반환하고 선택적으로 plan family도 검증합니다.
- `findRuleByPlanVersion(planVersionRef, featureKey, expectedPlanId?)`, 고정된 버전의 규칙 하나를 반환하고 선택적으로 plan family도 검증합니다.

### BillingStoreSubscriptionProvider

- `getCurrentPlanId(tenantId)`, 빌링 구독에서 현재 플랜 ID를 찾습니다.
- `getCurrentPlanVersion(tenantId)`, 빌링 구독에 고정된 plan ID와 `PlanVersionRef`를 함께 반환합니다.

### Schema

- `planEntitlementSets`, 등록된 immutable plan version과 plan family를 저장합니다.
- `planEntitlements`, `planVersionRef`와 기능 키 조합별 entitlement 규칙 및 `meterBilling` intent를 저장합니다.
- `DRIZZLE_TOKEN`, 레지스트리용 Drizzle 클라이언트 토큰입니다.
- `BILLING_STORE_TOKEN`, 구독 제공자용 빌링 스토어 토큰입니다.

## 기존 테이블 마이그레이션

`plan_entitlements.plan_version_ref`는 plan-ID-only 배포에서 단계적으로 옮길 수 있도록 nullable입니다.

1. `plan_entitlement_sets` 테이블과 nullable `plan_version_ref`, `meter_billing` 컬럼을 먼저 배포합니다.
2. 각 기존 `plan_id`에 대해 운영자가 정확한 published `PlanVersionRef`를 선택합니다. 최신 버전을 자동 선택하지 않습니다.
3. 선택한 reference를 `plan_entitlement_sets`에 등록하고 해당 `plan_entitlements` 행을 backfill합니다. 기존 meter rule의 `meter_billing`도 meter definition과 대조해 `local` 또는 `required`로 명시합니다.
4. billing subscription의 `plan_version_ref`가 같은 값인지 검증한 뒤 version-aware provider와 registry 조회를 활성화합니다.
5. null 행이 없음을 검증한 후 애플리케이션 migration에서 `plan_version_ref`를 `NOT NULL`로 강화할 수 있습니다.

`addPlanVersionEntitlementsPostgres()`가 1단계 schema를 적용하고,
`backfillPlanVersionEntitlementsPostgres()`가 transaction을 지원하는 client에서 운영자가 전달한 one-to-one mapping만 backfill합니다. 기존 reference가 다른 plan family에 속하거나, 같은 version에 feature rule이 중복되거나, inline quota 및 billable meter binding이 누락되면 mutation 전에 실패합니다. Legacy row가 없는 빈 entitlement set은 mapping에 `allowEmpty: true`를 명시해야만 발행됩니다.

버전 조회는 먼저 `plan_entitlement_sets`의 등록 여부를 확인합니다. 등록되지 않은 reference는 빈 entitlement set이나 최신 plan fallback으로 처리하지 않고 `entitlements-core/plan-version-not-found` Problem으로 실패합니다.

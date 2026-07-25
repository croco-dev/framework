---
editUrl: false
next: false
prev: false
title: "migrateSubscriptionPlanVersion"
---

> **migrateSubscriptionPlanVersion**(`subscription`, `ref`, `registry`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

레거시 구독에 검증된 플랜 버전을 명시적으로 고정합니다.

## Parameters

### subscription

[`LegacySubscription`](/api/billing-core/src/type-aliases/legacysubscription/)

### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

### registry

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

## Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

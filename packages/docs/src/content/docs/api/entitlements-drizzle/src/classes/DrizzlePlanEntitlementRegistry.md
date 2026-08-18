---
editUrl: false
next: false
prev: false
title: "DrizzlePlanEntitlementRegistry"
---

플랜별 권한 규칙을 Drizzle 테이블에서 조회하는 구현체입니다.

## Extends

- [`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/)

## Constructors

### Constructor

> **new DrizzlePlanEntitlementRegistry**(`db`): `DrizzlePlanEntitlementRegistry`

Drizzle 클라이언트를 받아 권한 레지스트리를 초기화합니다.

#### Parameters

##### db

`DrizzleEntitlementsClient`

#### Returns

`DrizzlePlanEntitlementRegistry`

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`constructor`](/api/entitlements-core/src/classes/planentitlementregistry/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/)\>

#### Inherited from

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`token`](/api/entitlements-core/src/classes/planentitlementregistry/#token)

## Methods

### findRule()

> **findRule**(`planId`, `featureKey`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

플랜에서 특정 기능 키의 규칙을 조회합니다.

#### Parameters

##### planId

`string`

##### featureKey

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`findRule`](/api/entitlements-core/src/classes/planentitlementregistry/#findrule)

***

### findRuleByPlanVersion()

> **findRuleByPlanVersion**(`ref`, `featureKey`, `expectedPlanId?`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

고정된 플랜 버전에서 특정 기능 키의 규칙을 조회합니다.

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

##### featureKey

`string`

##### expectedPlanId?

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`findRuleByPlanVersion`](/api/entitlements-core/src/classes/planentitlementregistry/#findrulebyplanversion)

***

### getEntitlements()

> **getEntitlements**(`planId`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

플랜에 연결된 모든 권한 규칙을 반환합니다.

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`getEntitlements`](/api/entitlements-core/src/classes/planentitlementregistry/#getentitlements)

***

### getEntitlementsByPlanVersion()

> **getEntitlementsByPlanVersion**(`ref`, `expectedPlanId?`): `Promise`\<readonly [`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

고정된 플랜 버전에 연결된 모든 권한 규칙을 반환합니다.

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

##### expectedPlanId?

`string`

#### Returns

`Promise`\<readonly [`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`getEntitlementsByPlanVersion`](/api/entitlements-core/src/classes/planentitlementregistry/#getentitlementsbyplanversion)

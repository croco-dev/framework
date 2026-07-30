---
editUrl: false
next: false
prev: false
title: "InMemoryPlanEntitlementRegistry"
---

테스트와 로컬 개발용 인메모리 플랜 entitlement 레지스트리입니다.

## Extends

- [`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/)

## Constructors

### Constructor

> **new InMemoryPlanEntitlementRegistry**(): `InMemoryPlanEntitlementRegistry`

#### Returns

`InMemoryPlanEntitlementRegistry`

#### Inherited from

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`constructor`](/api/entitlements-core/src/classes/planentitlementregistry/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/)\>

#### Inherited from

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`token`](/api/entitlements-core/src/classes/planentitlementregistry/#token)

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

---

### findRule()

> **findRule**(`planId`, `featureKey`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

#### Parameters

##### planId

`string`

##### featureKey

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`findRule`](/api/entitlements-core/src/classes/planentitlementregistry/#findrule)

---

### findRuleByPlanVersion()

> **findRuleByPlanVersion**(`ref`, `featureKey`, `expectedPlanId?`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

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

---

### getEntitlements()

> **getEntitlements**(`planId`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`getEntitlements`](/api/entitlements-core/src/classes/planentitlementregistry/#getentitlements)

---

### getEntitlementsByPlanVersion()

> **getEntitlementsByPlanVersion**(`ref`, `expectedPlanId?`): `Promise`\<readonly [`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

##### expectedPlanId?

`string`

#### Returns

`Promise`\<readonly [`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Overrides

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/).[`getEntitlementsByPlanVersion`](/api/entitlements-core/src/classes/planentitlementregistry/#getentitlementsbyplanversion)

---

### register()

#### Call Signature

> **register**(`definition`): `void`

##### Parameters

###### definition

[`PlanEntitlements`](/api/entitlements-core/src/type-aliases/planentitlements/)

##### Returns

`void`

#### Call Signature

> **register**(`planId`, `rules`): `void`

##### Parameters

###### planId

`string`

###### rules

[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]

##### Returns

`void`

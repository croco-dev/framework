---
editUrl: false
next: false
prev: false
title: "PlanEntitlementRegistry"
---

## Extended by

- [`InMemoryPlanEntitlementRegistry`](/api/entitlements-core/src/classes/inmemoryplanentitlementregistry/)
- [`DrizzlePlanEntitlementRegistry`](/api/entitlements-drizzle/src/classes/drizzleplanentitlementregistry/)

## Constructors

### Constructor

> **new PlanEntitlementRegistry**(): `PlanEntitlementRegistry`

#### Returns

`PlanEntitlementRegistry`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`PlanEntitlementRegistry`\>

## Methods

### findRule()

> `abstract` **findRule**(`planId`, `featureKey`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

#### Parameters

##### planId

`string`

##### featureKey

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/) \| `null`\>

***

### getEntitlements()

> `abstract` **getEntitlements**(`planId`): `Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<[`EntitlementRule`](/api/entitlements-core/src/type-aliases/entitlementrule/)[]\>

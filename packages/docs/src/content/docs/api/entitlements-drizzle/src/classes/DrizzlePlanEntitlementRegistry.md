---
editUrl: false
next: false
prev: false
title: "DrizzlePlanEntitlementRegistry"
---

플랜별 권한 규칙을 Drizzle 테이블에서 조회하는 구현체입니다.

## Extends

- `PlanEntitlementRegistry`

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

`PlanEntitlementRegistry.constructor`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`PlanEntitlementRegistry`\>

#### Inherited from

`PlanEntitlementRegistry.token`

## Methods

### findRule()

> **findRule**(`planId`, `featureKey`): `Promise`\<`EntitlementRule` \| `null`\>

플랜에서 특정 기능 키의 규칙을 조회합니다.

#### Parameters

##### planId

`string`

##### featureKey

`string`

#### Returns

`Promise`\<`EntitlementRule` \| `null`\>

#### Overrides

`PlanEntitlementRegistry.findRule`

***

### getEntitlements()

> **getEntitlements**(`planId`): `Promise`\<`EntitlementRule`[]\>

플랜에 연결된 모든 권한 규칙을 반환합니다.

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<`EntitlementRule`[]\>

#### Overrides

`PlanEntitlementRegistry.getEntitlements`

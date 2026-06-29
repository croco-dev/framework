---
editUrl: false
next: false
prev: false
title: "EntitlementGuard"
---

라우트 실행 전에 entitlement를 검사하는 가드입니다.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/entitlements-core/src/type-aliases/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new EntitlementGuard**(`entitlementManager`): `EntitlementGuard`

#### Parameters

##### entitlementManager

[`EntitlementManager`](/api/entitlements-core/src/classes/entitlementmanager/)

#### Returns

`EntitlementGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`RouteExecutionContext`](/api/entitlements-core/src/type-aliases/routeexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)

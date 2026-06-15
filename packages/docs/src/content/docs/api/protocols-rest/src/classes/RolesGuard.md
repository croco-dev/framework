---
editUrl: false
next: false
prev: false
title: "RolesGuard"
---

`@Roles` 메타데이터와 요청 사용자 역할을 비교해 접근을 제어하는 Guard입니다.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)\>

## Constructors

### Constructor

> **new RolesGuard**(): `RolesGuard`

#### Returns

`RolesGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean`

#### Parameters

##### context

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)

#### Returns

`boolean`

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)

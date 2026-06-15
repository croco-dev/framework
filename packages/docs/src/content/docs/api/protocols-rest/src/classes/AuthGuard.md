---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

Authorization 헤더를 검증해 사용자 정보를 요청 객체에 주입하는 Guard입니다.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)\>

## Constructors

### Constructor

> **new AuthGuard**(`options`): `AuthGuard`

#### Parameters

##### options

[`AuthGuardOptions`](/api/protocols-rest/src/type-aliases/authguardoptions/)

#### Returns

`AuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)

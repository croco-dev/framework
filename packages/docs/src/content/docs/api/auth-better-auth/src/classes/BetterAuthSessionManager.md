---
editUrl: false
next: false
prev: false
title: "BetterAuthSessionManager"
---

Better Auth 세션 목록 조회와 세션 해제를 제공하는 매니저입니다.

## Implements

- [`BetterAuthSessionProvider`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/)

## Constructors

### Constructor

> **new BetterAuthSessionManager**(`factory`, `logger?`): `BetterAuthSessionManager`

#### Parameters

##### factory

###### getAuth

() => `object`

##### logger?

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`BetterAuthSessionManager`

## Methods

### getSession()

> **getSession**(`token`): `Promise`\<[`BetterAuthSession`](/api/auth-better-auth/src/type-aliases/betterauthsession/) \| `null`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<[`BetterAuthSession`](/api/auth-better-auth/src/type-aliases/betterauthsession/) \| `null`\>

#### Implementation of

[`BetterAuthSessionProvider`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/).[`getSession`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/#getsession)

***

### revokeSession()

> **revokeSession**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BetterAuthSessionProvider`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/).[`revokeSession`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/#revokesession)

***

### revokeUserSessions()

> **revokeUserSessions**(`userId`): `Promise`\<`void`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`BetterAuthSessionProvider`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/).[`revokeUserSessions`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/#revokeusersessions)

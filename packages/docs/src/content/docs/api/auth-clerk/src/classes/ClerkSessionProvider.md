---
editUrl: false
next: false
prev: false
title: "ClerkSessionProvider"
---

Clerk 세션 조회와 세션 해제를 담당하는 구현체입니다.

## Implements

- [`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/)

## Constructors

### Constructor

> **new ClerkSessionProvider**(`options`): `ClerkSessionProvider`

#### Parameters

##### options

[`ClerkAuthOptions`](/api/auth-clerk/src/type-aliases/clerkauthoptions/)

#### Returns

`ClerkSessionProvider`

## Methods

### getSession()

> **getSession**(`sessionId`): `Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`getSession`](/api/auth-core/src/interfaces/sessionprovider/#getsession)

***

### listSessions()

> **listSessions**(`options`): `Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

#### Parameters

##### options

[`SessionListOptions`](/api/auth-core/src/type-aliases/sessionlistoptions/)

#### Returns

`Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`listSessions`](/api/auth-core/src/interfaces/sessionprovider/#listsessions)

***

### revokeAllSessions()

> **revokeAllSessions**(`userId`): `Promise`\<`void`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`revokeAllSessions`](/api/auth-core/src/interfaces/sessionprovider/#revokeallsessions)

***

### revokeSession()

> **revokeSession**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SessionProvider`](/api/auth-core/src/interfaces/sessionprovider/).[`revokeSession`](/api/auth-core/src/interfaces/sessionprovider/#revokesession)

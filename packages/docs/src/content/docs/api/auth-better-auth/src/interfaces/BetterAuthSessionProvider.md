---
editUrl: false
next: false
prev: false
title: "BetterAuthSessionProvider"
---

Better Auth 세션 제공자가 구현해야 하는 인터페이스입니다.

## Methods

### getSession()

> **getSession**(`token`): `Promise`\<[`BetterAuthSession`](/api/auth-better-auth/src/type-aliases/betterauthsession/) \| `null`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<[`BetterAuthSession`](/api/auth-better-auth/src/type-aliases/betterauthsession/) \| `null`\>

---

### revokeSession()

> **revokeSession**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

---

### revokeUserSessions()

> **revokeUserSessions**(`userId`): `Promise`\<`void`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

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

> **revokeSession**(`sessionToken`): `Promise`\<`void`\>

해제할 세션 토큰으로 해당 세션을 인증하고 해제합니다.

#### Parameters

##### sessionToken

`string`

#### Returns

`Promise`\<`void`\>

---

### revokeUserSessions()

> **revokeUserSessions**(`userId`, `adminSessionToken`): `Promise`\<`void`\>

`session:revoke` 권한이 있는 관리자 세션으로 사용자의 모든 세션을 해제합니다.

#### Parameters

##### userId

`string`

##### adminSessionToken

`string`

#### Returns

`Promise`\<`void`\>

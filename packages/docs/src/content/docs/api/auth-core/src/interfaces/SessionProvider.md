---
editUrl: false
next: false
prev: false
title: "SessionProvider"
---

세션 조회와 관리에 사용하는 타입과 공급자 계약입니다.

## Methods

### getSession()

> **getSession**(`sessionId`): `Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

***

### listSessions()

> **listSessions**(`options`): `Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

#### Parameters

##### options

[`SessionListOptions`](/api/auth-core/src/type-aliases/sessionlistoptions/)

#### Returns

`Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

***

### revokeAllSessions()

> **revokeAllSessions**(`userId`): `Promise`\<`void`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

***

### revokeSession()

> **revokeSession**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "SessionProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:26](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L26)

세션 조회와 관리에 사용하는 타입과 공급자 계약입니다.

## Methods

### getSession()

> **getSession**(`sessionId`): `Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L27)

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`Session`](/api/auth-core/src/type-aliases/session/) \| `null`\>

***

### listSessions()

> **listSessions**(`options`): `Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L28)

#### Parameters

##### options

[`SessionListOptions`](/api/auth-core/src/type-aliases/sessionlistoptions/)

#### Returns

`Promise`\<[`SessionListResult`](/api/auth-core/src/type-aliases/sessionlistresult/)\>

***

### revokeAllSessions()

> **revokeAllSessions**(`userId`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:30](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L30)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

***

### revokeSession()

> **revokeSession**(`sessionId`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:29](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L29)

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "ShutdownManager"
---

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ShutdownManager.ts#L9)

프로세스 종료 시그널을 수신하고 등록된 shutdown 훅을 실행하는 매니저입니다.

## Methods

### listen()

> **listen**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:44](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ShutdownManager.ts#L44)

#### Returns

`void`

***

### register()

> **register**(`hook`): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:37](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ShutdownManager.ts#L37)

#### Parameters

##### hook

[`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

#### Returns

`void`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:57](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ShutdownManager.ts#L57)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(`timeoutMs?`): `ShutdownManager`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ShutdownManager.ts#L20)

#### Parameters

##### timeoutMs?

`number`

#### Returns

`ShutdownManager`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ShutdownManager.ts#L27)

#### Returns

`void`

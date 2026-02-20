---
editUrl: false
next: false
prev: false
title: "ShutdownManager"
---

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:5](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/framework-context/src/libs/ShutdownManager.ts#L5)

## Methods

### listen()

> **listen**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:40](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/framework-context/src/libs/ShutdownManager.ts#L40)

#### Returns

`void`

***

### register()

> **register**(`hook`): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:33](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/framework-context/src/libs/ShutdownManager.ts#L33)

#### Parameters

##### hook

[`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

#### Returns

`void`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:53](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/framework-context/src/libs/ShutdownManager.ts#L53)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(`timeoutMs?`): `ShutdownManager`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:16](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/framework-context/src/libs/ShutdownManager.ts#L16)

#### Parameters

##### timeoutMs?

`number`

#### Returns

`ShutdownManager`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:23](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/framework-context/src/libs/ShutdownManager.ts#L23)

#### Returns

`void`

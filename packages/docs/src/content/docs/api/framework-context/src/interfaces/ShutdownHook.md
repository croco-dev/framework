---
editUrl: false
next: false
prev: false
title: "ShutdownHook"
---

Defined in: [packages/framework-context/src/libs/types.ts:75](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/types.ts#L75)

Shutdown hook interface for graceful shutdown

## Methods

### onShutdown()

> **onShutdown**(`signal?`): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:79](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/types.ts#L79)

Called during graceful shutdown process

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

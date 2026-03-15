---
editUrl: false
next: false
prev: false
title: "ShutdownHook"
---

Defined in: [packages/framework-context/src/libs/types.ts:120](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/framework-context/src/libs/types.ts#L120)

Shutdown hook interface for graceful shutdown

## Methods

### onShutdown()

> **onShutdown**(`signal?`): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:124](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/framework-context/src/libs/types.ts#L124)

Called during graceful shutdown process

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

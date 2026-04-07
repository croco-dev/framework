---
editUrl: false
next: false
prev: false
title: "ILogger"
---

Defined in: [packages/framework-context/src/libs/ILogger.ts:3](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/ILogger.ts#L3)

## Methods

### child()

> **child**(`bindings`): `ILogger`

Defined in: [packages/framework-context/src/libs/ILogger.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/ILogger.ts#L8)

#### Parameters

##### bindings

`Record`\<`string`, `unknown`\>

#### Returns

`ILogger`

***

### debug()

> **debug**(`message`, `context?`): `void`

Defined in: [packages/framework-context/src/libs/ILogger.ts:4](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/ILogger.ts#L4)

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### error()

> **error**(`message`, `context?`): `void`

Defined in: [packages/framework-context/src/libs/ILogger.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/ILogger.ts#L7)

#### Parameters

##### message

`string`

##### context?

`Error` | `Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### info()

> **info**(`message`, `context?`): `void`

Defined in: [packages/framework-context/src/libs/ILogger.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/ILogger.ts#L5)

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### warn()

> **warn**(`message`, `context?`): `void`

Defined in: [packages/framework-context/src/libs/ILogger.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/ILogger.ts#L6)

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

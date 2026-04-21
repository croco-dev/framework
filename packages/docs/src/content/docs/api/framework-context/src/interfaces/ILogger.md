---
editUrl: false
next: false
prev: false
title: "ILogger"
---

Defined in: [packages/framework-context/src/libs/ILogger.ts:3](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ILogger.ts#L3)

Croco 전역 로거가 따라야 하는 최소 인터페이스 타입입니다.

## Example

```typescript
import type { ILogger } from '@croco/framework-context';

const logger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};
```

## Methods

### child()

> **child**(`bindings`): `ILogger`

Defined in: [packages/framework-context/src/libs/ILogger.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ILogger.ts#L8)

#### Parameters

##### bindings

`Record`\<`string`, `unknown`\>

#### Returns

`ILogger`

***

### debug()

> **debug**(`message`, `context?`): `void`

Defined in: [packages/framework-context/src/libs/ILogger.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ILogger.ts#L4)

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

Defined in: [packages/framework-context/src/libs/ILogger.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ILogger.ts#L7)

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

Defined in: [packages/framework-context/src/libs/ILogger.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ILogger.ts#L5)

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

Defined in: [packages/framework-context/src/libs/ILogger.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/ILogger.ts#L6)

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

---
editUrl: false
next: false
prev: false
title: "ILogger"
---

Croco 전역 로거가 따라야 하는 최소 인터페이스 타입입니다.

## Example

```typescript
import type { ILogger } from "@croco/framework-context";

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

#### Parameters

##### bindings

`Record`\<`string`, `unknown`\>

#### Returns

`ILogger`

---

### debug()

> **debug**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

---

### error()

> **error**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

`Error` | `Record`\<`string`, `unknown`\>

#### Returns

`void`

---

### info()

> **info**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

---

### warn()

> **warn**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

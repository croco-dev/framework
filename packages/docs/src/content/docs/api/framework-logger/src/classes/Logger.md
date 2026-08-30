---
editUrl: false
next: false
prev: false
title: "Logger"
---

Croco 전역 로거가 따라야 하는 최소 인터페이스 타입입니다.

## Example

```typescript
import type { ILogger } from "@croco/framework-context";

const logger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => logger,
};
```

## Implements

- [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

## Constructors

### Constructor

> **new Logger**(`config`): `Logger`

#### Parameters

##### config

[`ConfigService`](/api/framework-config/src/classes/configservice/)

#### Returns

`Logger`

## Methods

### child()

> **child**(`bindings`): [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

Create a child logger with bound context

#### Parameters

##### bindings

[`LogContext`](/api/framework-logger/src/type-aliases/logcontext/)

#### Returns

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Implementation of

[`ILogger`](/api/framework-context/src/interfaces/ilogger/).[`child`](/api/framework-context/src/interfaces/ilogger/#child)

---

### debug()

> **debug**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

[`LogContext`](/api/framework-logger/src/type-aliases/logcontext/)

#### Returns

`void`

#### Implementation of

[`ILogger`](/api/framework-context/src/interfaces/ilogger/).[`debug`](/api/framework-context/src/interfaces/ilogger/#debug)

---

### error()

> **error**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

`Error` \| [`LogContext`](/api/framework-logger/src/type-aliases/logcontext/)

#### Returns

`void`

#### Implementation of

[`ILogger`](/api/framework-context/src/interfaces/ilogger/).[`error`](/api/framework-context/src/interfaces/ilogger/#error)

---

### fatal()

> **fatal**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

`Error` \| [`LogContext`](/api/framework-logger/src/type-aliases/logcontext/)

#### Returns

`void`

#### Implementation of

[`ILogger`](/api/framework-context/src/interfaces/ilogger/).[`fatal`](/api/framework-context/src/interfaces/ilogger/#fatal)

---

### info()

> **info**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

[`LogContext`](/api/framework-logger/src/type-aliases/logcontext/)

#### Returns

`void`

#### Implementation of

[`ILogger`](/api/framework-context/src/interfaces/ilogger/).[`info`](/api/framework-context/src/interfaces/ilogger/#info)

---

### warn()

> **warn**(`message`, `context?`): `void`

#### Parameters

##### message

`string`

##### context?

[`LogContext`](/api/framework-logger/src/type-aliases/logcontext/)

#### Returns

`void`

#### Implementation of

[`ILogger`](/api/framework-context/src/interfaces/ilogger/).[`warn`](/api/framework-context/src/interfaces/ilogger/#warn)

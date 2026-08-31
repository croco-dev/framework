---
editUrl: false
next: false
prev: false
title: "ShutdownManager"
---

종료 훅을 등록하고 프로세스 시그널에서 graceful shutdown을 실행하는 매니저 클래스입니다.

## Param

**hook**

`manager.register(hook)`로 등록할 shutdown 훅입니다.

## Example

```typescript
import { ShutdownManager } from "@croco/framework-context";

const manager = ShutdownManager.getInstance();
manager.register({
  onShutdown: async () => {},
});
manager.listen();
```

## Methods

### configure()

> **configure**(`timeoutMs`): `void`

#### Parameters

##### timeoutMs

`number`

#### Returns

`void`

---

### listen()

> **listen**(): `void`

#### Returns

`void`

---

### register()

> **register**(`hook`): `void`

#### Parameters

##### hook

[`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

#### Returns

`void`

---

### shutdown()

> **shutdown**(`options?`): `Promise`\<`void`\>

#### Parameters

##### options?

[`ShutdownOptions`](/api/framework-context/src/type-aliases/shutdownoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

---

### disposeCurrentScope()

> `static` **disposeCurrentScope**(): `void`

#### Returns

`void`

---

### disposeScope()

> `static` **disposeScope**(`scopeId`): `void`

#### Parameters

##### scopeId

`string`

#### Returns

`void`

---

### getInstance()

> `static` **getInstance**(`timeoutMs?`): `ShutdownManager`

#### Parameters

##### timeoutMs?

`number`

#### Returns

`ShutdownManager`

---

### reset()

> `static` **reset**(): `void`

#### Returns

`void`

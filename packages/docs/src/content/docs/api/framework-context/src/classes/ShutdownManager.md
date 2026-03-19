---
editUrl: false
next: false
prev: false
title: "ShutdownManager"
---

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/ShutdownManager.ts#L6)

종료 훅을 등록하고 프로세스 시그널에서 graceful shutdown을 실행하는 매니저 클래스입니다.

## Param

`manager.register(hook)`로 등록할 shutdown 훅입니다.

## Example

```typescript
import { ShutdownManager } from '@croco/framework-context';

const manager = ShutdownManager.getInstance();
manager.register({
  onShutdown: async () => {},
});
manager.listen();
```

## Methods

### listen()

> **listen**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:41](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/ShutdownManager.ts#L41)

#### Returns

`void`

***

### register()

> **register**(`hook`): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:34](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/ShutdownManager.ts#L34)

#### Parameters

##### hook

[`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

#### Returns

`void`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:54](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/ShutdownManager.ts#L54)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(`timeoutMs?`): `ShutdownManager`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:17](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/ShutdownManager.ts#L17)

#### Parameters

##### timeoutMs?

`number`

#### Returns

`ShutdownManager`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/ShutdownManager.ts#L24)

#### Returns

`void`

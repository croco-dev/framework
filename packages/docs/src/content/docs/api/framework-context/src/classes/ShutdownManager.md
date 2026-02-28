---
editUrl: false
next: false
prev: false
title: "ShutdownManager"
---

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/ShutdownManager.ts#L5)

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

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:40](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/ShutdownManager.ts#L40)

#### Returns

`void`

***

### register()

> **register**(`hook`): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:33](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/ShutdownManager.ts#L33)

#### Parameters

##### hook

[`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

#### Returns

`void`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:53](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/ShutdownManager.ts#L53)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(`timeoutMs?`): `ShutdownManager`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:16](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/ShutdownManager.ts#L16)

#### Parameters

##### timeoutMs?

`number`

#### Returns

`ShutdownManager`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/ShutdownManager.ts:23](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/ShutdownManager.ts#L23)

#### Returns

`void`

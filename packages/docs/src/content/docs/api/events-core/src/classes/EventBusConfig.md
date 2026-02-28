---
editUrl: false
next: false
prev: false
title: "EventBusConfig"
---

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L12)

전역 EventBus 설정과 핸들러 등록 초기화를 관리합니다.

## Constructors

### Constructor

> **new EventBusConfig**(): `EventBusConfig`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L17)

#### Returns

`EventBusConfig`

## Methods

### getEventBus()

> **getEventBus**(): [`EventBus`](/api/events-core/src/interfaces/eventbus/)

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:30](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L30)

#### Returns

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

***

### setEventBus()

> **setEventBus**(`eventBus`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:37](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L37)

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`void`

***

### start()

> **start**(`options`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:45](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L45)

#### Parameters

##### options

`EventBusStartOptions`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:41](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L41)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### getInstance()

> `static` **getInstance**(): `EventBusConfig`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:19](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L19)

#### Returns

`EventBusConfig`

***

### setInstance()

> `static` **setInstance**(`config`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:26](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBusConfig.ts#L26)

#### Parameters

##### config

`EventBusConfig`

#### Returns

`void`

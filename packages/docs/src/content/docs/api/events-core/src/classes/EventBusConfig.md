---
editUrl: false
next: false
prev: false
title: "EventBusConfig"
---

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:11](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventBusConfig.ts#L11)

## Methods

### getEventBus()

> **getEventBus**(): [`EventBus`](/api/events-core/src/interfaces/eventbus/)

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:26](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventBusConfig.ts#L26)

#### Returns

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

***

### setEventBus()

> **setEventBus**(`eventBus`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:30](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventBusConfig.ts#L30)

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`void`

***

### start()

> **start**(`options`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:38](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventBusConfig.ts#L38)

#### Parameters

##### options

`EventBusStartOptions`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:34](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventBusConfig.ts#L34)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### getInstance()

> `static` **getInstance**(): `EventBusConfig`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:18](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventBusConfig.ts#L18)

#### Returns

`EventBusConfig`

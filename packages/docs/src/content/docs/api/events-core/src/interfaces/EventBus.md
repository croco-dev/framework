---
editUrl: false
next: false
prev: false
title: "EventBus"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBus.ts#L10)

이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBus.ts#L14)

#### Returns

`void`

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventBus.ts:11](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBus.ts#L11)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBus.ts#L12)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:13](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventBus.ts#L13)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

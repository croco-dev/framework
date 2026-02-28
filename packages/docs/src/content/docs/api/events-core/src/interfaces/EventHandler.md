---
editUrl: false
next: false
prev: false
title: "EventHandler"
---

Defined in: [packages/events-core/src/libs/EventHandler.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventHandler.ts#L4)

이벤트 핸들러 계약 타입과 핸들러 클래스 타입입니다.

## Type Parameters

### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### handle()

> **handle**(`event`): `void` \| `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventHandler.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventHandler.ts#L5)

#### Parameters

##### event

`T`

#### Returns

`void` \| `Promise`\<`void`\>

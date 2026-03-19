---
editUrl: false
next: false
prev: false
title: "EventHandler"
---

Defined in: [packages/events-core/src/libs/EventHandler.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventHandler.ts#L5)

이벤트 핸들러 계약 타입과 핸들러 클래스 타입입니다.

## Type Parameters

### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### handle()

> **handle**(`event`): `void` \| `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventHandler.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventHandler.ts#L6)

#### Parameters

##### event

`T`

#### Returns

`void` \| `Promise`\<`void`\>

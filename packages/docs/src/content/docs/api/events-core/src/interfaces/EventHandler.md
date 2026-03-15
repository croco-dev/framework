---
editUrl: false
next: false
prev: false
title: "EventHandler"
---

Defined in: [packages/events-core/src/libs/EventHandler.ts:5](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventHandler.ts#L5)

이벤트 핸들러 계약 타입과 핸들러 클래스 타입입니다.

## Type Parameters

### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### handle()

> **handle**(`event`): `void` \| `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventHandler.ts:6](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventHandler.ts#L6)

#### Parameters

##### event

`T`

#### Returns

`void` \| `Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "RegisterEventHandler"
---

> **RegisterEventHandler**\<`TArgs`\>(`eventClass`, `options?`): \<`T`\>(`f`) => `void`

Defined in: [packages/events-core/src/libs/EventHandler.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventHandler.ts#L31)

이벤트 클래스와 핸들러 클래스를 연결하는 데코레이터입니다.

## Type Parameters

### TArgs

`TArgs` *extends* `unknown`[]

## Parameters

### eventClass

`DomainEventClass`\<`TArgs`\>

### options?

#### eventName?

`string`

## Returns

> \<`T`\>(`f`): `void`

### Type Parameters

#### T

`T` *extends* [`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>

### Parameters

#### f

`T`

### Returns

`void`

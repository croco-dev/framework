---
editUrl: false
next: false
prev: false
title: "RegisterEventHandler"
---

> **RegisterEventHandler**\<`TArgs`\>(`eventClass`, `options?`): \<`T`\>(`f`) => `void`

이벤트 클래스와 핸들러 클래스를 연결하는 데코레이터입니다.

## Type Parameters

### TArgs

`TArgs` _extends_ `unknown`[]

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

`T` _extends_ [`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>

### Parameters

#### f

`T`

### Returns

`void`

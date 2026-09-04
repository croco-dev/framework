---
editUrl: false
next: false
prev: false
title: "RegisterEventHandler"
---

> **RegisterEventHandler**\<`TEvent`, `TArgs`\>(`eventClass`, `options?`): \<`T`\>(`f`) => `void`

이벤트 클래스와 핸들러 클래스를 연결하는 데코레이터입니다.

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

### TArgs

`TArgs` _extends_ `unknown`[]

## Parameters

### eventClass

`DomainEventClass`\<`TEvent`, `TArgs`\>

### options?

#### eventName?

`string`

#### handlerId?

`string`

## Returns

\<`T`\>(`f`) => `void`

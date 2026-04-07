---
editUrl: false
next: false
prev: false
title: "RegisterEventHandler"
---

> **RegisterEventHandler**\<`TArgs`\>(`eventClass`, `options?`): \<`T`\>(`f`) => `void`

Defined in: [packages/events-core/src/libs/EventHandler.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventHandler.ts#L25)

이벤트 타입과 핸들러를 연결하는 클래스 데코레이터입니다.

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

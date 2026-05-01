---
editUrl: false
next: false
prev: false
title: "EventSubscription"
---

이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### eventName

> **eventName**: `string`

***

### handler?

> `optional` **handler**: [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`TEvent`\>

***

### handlerClass

> **handlerClass**: [`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`TEvent`\>

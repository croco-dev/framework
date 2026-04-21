---
editUrl: false
next: false
prev: false
title: "EventSubscription"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L6)

이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### eventName

> **eventName**: `string`

Defined in: [packages/events-core/src/libs/EventBus.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L7)

***

### handler?

> `optional` **handler**: [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`TEvent`\>

Defined in: [packages/events-core/src/libs/EventBus.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L9)

***

### handlerClass

> **handlerClass**: [`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`TEvent`\>

Defined in: [packages/events-core/src/libs/EventBus.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L8)

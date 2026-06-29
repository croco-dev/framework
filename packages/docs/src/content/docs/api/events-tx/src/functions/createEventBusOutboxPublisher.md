---
editUrl: false
next: false
prev: false
title: "createEventBusOutboxPublisher"
---

> **createEventBusOutboxPublisher**(`eventBus`, `serializer?`): (`message`) => `Promise`\<`void`\>

Outbox append, relay, inbox idempotency를 제공하는 런타임 서비스입니다.

## Parameters

### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

### serializer?

[`EventSerializer`](/api/events-core/src/interfaces/eventserializer/) = `...`

## Returns

(`message`) => `Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "EventSubscription"
---

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### eventName

> **eventName**: `string`

---

### handler?

> `optional` **handler?**: `EventHandler`\<`TEvent`\>

---

### handlerClass

> **handlerClass**: `EventHandlerClass`\<`TEvent`\>

---

### handlerId?

> `optional` **handlerId?**: `string`

Explicit identity that remains stable across builds. Required by DLQ-enabled buses.

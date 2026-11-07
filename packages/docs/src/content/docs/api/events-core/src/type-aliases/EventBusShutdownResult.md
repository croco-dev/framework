---
editUrl: false
next: false
prev: false
title: "EventBusShutdownResult"
---

> **EventBusShutdownResult** = \{ `status`: `"drained"`; `unfinishedHandlers`: readonly \[\]; \} \| \{ `status`: `"timed-out"` \| `"cancelled"`; `unfinishedHandlers`: readonly [`EventBusActiveHandler`](/api/events-core/src/type-aliases/eventbusactivehandler/)[]; `unfinishedReplays?`: readonly [`EventBusActiveReplay`](/api/events-core/src/type-aliases/eventbusactivereplay/)[]; \}

## Union Members

### Type Literal

\{ `status`: `"drained"`; `unfinishedHandlers`: readonly \[\]; \}

---

### Type Literal

\{ `status`: `"timed-out"` \| `"cancelled"`; `unfinishedHandlers`: readonly [`EventBusActiveHandler`](/api/events-core/src/type-aliases/eventbusactivehandler/)[]; `unfinishedReplays?`: readonly [`EventBusActiveReplay`](/api/events-core/src/type-aliases/eventbusactivereplay/)[]; \}

#### status

> `readonly` **status**: `"timed-out"` \| `"cancelled"`

#### unfinishedHandlers

> `readonly` **unfinishedHandlers**: readonly [`EventBusActiveHandler`](/api/events-core/src/type-aliases/eventbusactivehandler/)[]

#### unfinishedReplays?

> `readonly` `optional` **unfinishedReplays?**: readonly [`EventBusActiveReplay`](/api/events-core/src/type-aliases/eventbusactivereplay/)[]

Present when the implementation tracks dead-letter replay batches.

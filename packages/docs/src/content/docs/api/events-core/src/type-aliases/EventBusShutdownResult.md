---
editUrl: false
next: false
prev: false
title: "EventBusShutdownResult"
---

> **EventBusShutdownResult** = \{ `status`: `"drained"`; `unfinishedHandlers`: readonly \[\]; \} \| \{ `status`: `"timed-out"` \| `"cancelled"`; `unfinishedHandlers`: readonly [`EventBusActiveHandler`](/api/events-core/src/type-aliases/eventbusactivehandler/)[]; \}

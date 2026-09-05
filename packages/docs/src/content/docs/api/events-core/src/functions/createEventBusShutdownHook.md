---
editUrl: false
next: false
prev: false
title: "createEventBusShutdownHook"
---

> **createEventBusShutdownHook**(`lifecycle`, `options?`): [`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

Adapts an EventBus lifecycle to framework-context's shutdown hook contract.

## Parameters

### lifecycle

[`EventBusLifecycle`](/api/events-core/src/interfaces/eventbuslifecycle/)

### options?

`Pick`\<[`EventBusShutdownOptions`](/api/events-core/src/type-aliases/eventbusshutdownoptions/), `"timeoutMs"`\> = `{}`

## Returns

[`ShutdownHook`](/api/framework-context/src/interfaces/shutdownhook/)

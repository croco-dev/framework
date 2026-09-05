---
editUrl: false
next: false
prev: false
title: "EventBusLifecycle"
---

Optional lifecycle capability for EventBus implementations that can close intake and drain work.

## Methods

### shutdown()

> **shutdown**(`options?`): `Promise`\<[`EventBusShutdownResult`](/api/events-core/src/type-aliases/eventbusshutdownresult/)\>

#### Parameters

##### options?

[`EventBusShutdownOptions`](/api/events-core/src/type-aliases/eventbusshutdownoptions/)

#### Returns

`Promise`\<[`EventBusShutdownResult`](/api/events-core/src/type-aliases/eventbusshutdownresult/)\>

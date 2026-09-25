---
editUrl: false
next: false
prev: false
title: "ProductEventDiagnosticsSink"
---

## Methods

### getObservation()

> **getObservation**(`scope`, `name`, `version`): [`EventObservation`](/api/analytics-core/src/type-aliases/eventobservation/)

#### Parameters

##### scope

[`ProductEventDiagnosticScope`](/api/analytics-core/src/type-aliases/producteventdiagnosticscope/)

##### name

`string`

##### version

`number`

#### Returns

[`EventObservation`](/api/analytics-core/src/type-aliases/eventobservation/)

---

### recordAccepted()

> **recordAccepted**(`scope`, `name`, `version`, `receivedAt`): `void`

#### Parameters

##### scope

[`ProductEventDiagnosticScope`](/api/analytics-core/src/type-aliases/producteventdiagnosticscope/)

##### name

`string`

##### version

`number`

##### receivedAt

`string`

#### Returns

`void`

---

### recordFailure()

> **recordFailure**(`scope`, `name`, `version`, `code`): `void`

#### Parameters

##### scope

[`ProductEventDiagnosticScope`](/api/analytics-core/src/type-aliases/producteventdiagnosticscope/)

##### name

`string`

##### version

`number`

##### code

`string`

#### Returns

`void`

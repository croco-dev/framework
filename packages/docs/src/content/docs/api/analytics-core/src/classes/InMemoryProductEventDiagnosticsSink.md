---
editUrl: false
next: false
prev: false
title: "InMemoryProductEventDiagnosticsSink"
---

Process-local diagnostics only; use an injected durable sink when retention is required.

## Implements

- [`ProductEventDiagnosticsSink`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/)

## Constructors

### Constructor

> **new InMemoryProductEventDiagnosticsSink**(`maxEntries?`, `maxFailureCodes?`): `InMemoryProductEventDiagnosticsSink`

#### Parameters

##### maxEntries?

`number` = `100`

##### maxFailureCodes?

`number` = `10`

#### Returns

`InMemoryProductEventDiagnosticsSink`

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

#### Implementation of

[`ProductEventDiagnosticsSink`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/).[`getObservation`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/#getobservation)

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

#### Implementation of

[`ProductEventDiagnosticsSink`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/).[`recordAccepted`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/#recordaccepted)

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

#### Implementation of

[`ProductEventDiagnosticsSink`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/).[`recordFailure`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/#recordfailure)

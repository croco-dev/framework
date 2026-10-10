---
editUrl: false
next: false
prev: false
title: "NetOutcomeSource"
---

> **NetOutcomeSource** = `object`

Server-only adapter. Scope and masking must be enforced by the host on every read.

## Methods

### drilldown()

> **drilldown**(`request`, `scope`): `Promise`\<[`NetOutcomeDrilldown`](/api/admin-core/src/type-aliases/netoutcomedrilldown/)\>

#### Parameters

##### request

[`NetOutcomeDrilldownRequest`](/api/admin-core/src/type-aliases/netoutcomedrilldownrequest/)

##### scope

[`OutcomeScope`](/api/metrics-core/src/type-aliases/outcomescope/)

#### Returns

`Promise`\<[`NetOutcomeDrilldown`](/api/admin-core/src/type-aliases/netoutcomedrilldown/)\>

---

### read()

> **read**(`request`, `scope`): `Promise`\<[`AssignedOutcomeReport`](/api/metrics-core/src/type-aliases/assignedoutcomereport/) \| [`AssignedOutcomeInput`](/api/metrics-core/src/type-aliases/assignedoutcomeinput/) \| `null`\>

#### Parameters

##### request

[`NetOutcomeRequest`](/api/admin-core/src/type-aliases/netoutcomerequest/)

##### scope

[`OutcomeScope`](/api/metrics-core/src/type-aliases/outcomescope/)

#### Returns

`Promise`\<[`AssignedOutcomeReport`](/api/metrics-core/src/type-aliases/assignedoutcomereport/) \| [`AssignedOutcomeInput`](/api/metrics-core/src/type-aliases/assignedoutcomeinput/) \| `null`\>

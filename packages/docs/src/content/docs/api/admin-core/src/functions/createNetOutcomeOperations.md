---
editUrl: false
next: false
prev: false
title: "createNetOutcomeOperations"
---

> **createNetOutcomeOperations**(`source`, `authority`): `object`

## Parameters

### source

[`NetOutcomeSource`](/api/admin-core/src/type-aliases/netoutcomesource/)

### authority

[`NetOutcomeAuthority`](/api/admin-core/src/type-aliases/netoutcomeauthority/)

## Returns

`object`

### export

> **export**: (`request`) => `Promise`\<[`NetOutcomeState`](/api/admin-core/src/type-aliases/netoutcomestate/)\>

#### Parameters

##### request

[`NetOutcomeRequest`](/api/admin-core/src/type-aliases/netoutcomerequest/)

#### Returns

`Promise`\<[`NetOutcomeState`](/api/admin-core/src/type-aliases/netoutcomestate/)\>

### read

> **read**: (`request`) => `Promise`\<[`NetOutcomeState`](/api/admin-core/src/type-aliases/netoutcomestate/)\>

#### Parameters

##### request

[`NetOutcomeRequest`](/api/admin-core/src/type-aliases/netoutcomerequest/)

#### Returns

`Promise`\<[`NetOutcomeState`](/api/admin-core/src/type-aliases/netoutcomestate/)\>

### drilldown()

> **drilldown**(`request`): `Promise`\<[`NetOutcomeDrilldown`](/api/admin-core/src/type-aliases/netoutcomedrilldown/)\>

#### Parameters

##### request

[`NetOutcomeDrilldownRequest`](/api/admin-core/src/type-aliases/netoutcomedrilldownrequest/)

#### Returns

`Promise`\<[`NetOutcomeDrilldown`](/api/admin-core/src/type-aliases/netoutcomedrilldown/)\>

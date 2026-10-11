---
editUrl: false
next: false
prev: false
title: "NetOutcomeAuthority"
---

> **NetOutcomeAuthority** = `object`

## Methods

### authorize()

> **authorize**(`action`, `scope`): `Promise`\<[`NetOutcomeGrant`](/api/admin-core/src/type-aliases/netoutcomegrant/) \| `null`\>

#### Parameters

##### action

`"read"` \| `"export"` \| `"drilldown"`

##### scope

[`OutcomeScope`](/api/metrics-core/src/type-aliases/outcomescope/)

#### Returns

`Promise`\<[`NetOutcomeGrant`](/api/admin-core/src/type-aliases/netoutcomegrant/) \| `null`\>

---

### currentScope()

> **currentScope**(): [`OutcomeScope`](/api/metrics-core/src/type-aliases/outcomescope/)

#### Returns

[`OutcomeScope`](/api/metrics-core/src/type-aliases/outcomescope/)

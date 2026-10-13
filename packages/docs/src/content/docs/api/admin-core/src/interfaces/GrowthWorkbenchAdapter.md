---
editUrl: false
next: false
prev: false
title: "GrowthWorkbenchAdapter"
---

## Methods

### actor()

> **actor**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

---

### authorize()

> **authorize**(`scope`, `permission`): `Promise`\<`boolean`\>

Host owns authenticated actor, tenant isolation, masking/deletion and source freshness. No browser-supplied actor.

#### Parameters

##### scope

[`GrowthScope`](/api/metrics-core/src/type-aliases/growthscope/)

##### permission

`"growth:read"` \| `"growth:report:read"` \| `"growth:report:write"`

#### Returns

`Promise`\<`boolean`\>

---

### read()

> **read**(`input`): `Promise`\<[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)\>

Must reject exceeded bounds, not truncate; immutable sourceRevision pins the source snapshot. Return aggregates only.

#### Parameters

##### input

###### maxRows

`number`

###### model

[`GrowthModel`](/api/metrics-core/src/type-aliases/growthmodel/)

###### scope

[`GrowthScope`](/api/metrics-core/src/type-aliases/growthscope/)

###### signal?

`AbortSignal`

###### sourceRevision

`string`

#### Returns

`Promise`\<[`GrowthDataset`](/api/metrics-core/src/type-aliases/growthdataset/)\>

---
editUrl: false
next: false
prev: false
title: "GrowthReportStore"
---

## Methods

### append()

> **append**(`scope`, `record`, `expectedRevision`): `Promise`\<`void`\>

Atomically compare expectedRevision and append an audit record. Reject model ID/version/hash collisions across history; never overwrite audit history.

#### Parameters

##### scope

[`GrowthScope`](/api/metrics-core/src/type-aliases/growthscope/)

##### record

[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/)

##### expectedRevision

`number`

#### Returns

`Promise`\<`void`\>

---

### read()

> **read**(`scope`, `id`): `Promise`\<[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/) \| `undefined`\>

#### Parameters

##### scope

[`GrowthScope`](/api/metrics-core/src/type-aliases/growthscope/)

##### id

`string`

#### Returns

`Promise`\<[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/) \| `undefined`\>

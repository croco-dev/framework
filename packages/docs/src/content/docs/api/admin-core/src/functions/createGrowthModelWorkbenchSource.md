---
editUrl: false
next: false
prev: false
title: "createGrowthModelWorkbenchSource"
---

> **createGrowthModelWorkbenchSource**(`input`): `object`

The UI submits definitions and scenarios; this server boundary validates, reads and calculates them.

## Parameters

### input

#### adapter

[`GrowthWorkbenchAdapter`](/api/admin-core/src/interfaces/growthworkbenchadapter/)

#### limits

[`GrowthLimits`](/api/metrics-core/src/type-aliases/growthlimits/)

#### reports?

[`GrowthReportStore`](/api/admin-core/src/interfaces/growthreportstore/)

## Returns

`object`

### calculate

> **calculate**: (`request`, `signal?`) => `Promise`\<[`GrowthWorkbenchReport`](/api/admin-core/src/type-aliases/growthworkbenchreport/)\>

#### Parameters

##### request

[`GrowthWorkbenchRequest`](/api/admin-core/src/type-aliases/growthworkbenchrequest/)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`GrowthWorkbenchReport`](/api/admin-core/src/type-aliases/growthworkbenchreport/)\>

### load()

> **load**(`request`, `signal?`): `Promise`\<[`GrowthWorkbenchState`](/api/admin-core/src/type-aliases/growthworkbenchstate/)\>

#### Parameters

##### request

[`GrowthWorkbenchRequest`](/api/admin-core/src/type-aliases/growthworkbenchrequest/)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`GrowthWorkbenchState`](/api/admin-core/src/type-aliases/growthworkbenchstate/)\>

### readSaved()

> **readSaved**(`scope`, `id`): `Promise`\<[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/) \| `undefined`\>

#### Parameters

##### scope

[`GrowthScope`](/api/metrics-core/src/type-aliases/growthscope/)

##### id

`string`

#### Returns

`Promise`\<[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/) \| `undefined`\>

### save()

> **save**(`request`, `id`, `expectedRevision`, `expectedAnalysisHash`): `Promise`\<[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/)\>

#### Parameters

##### request

[`GrowthWorkbenchRequest`](/api/admin-core/src/type-aliases/growthworkbenchrequest/)

##### id

`string`

##### expectedRevision

`number`

##### expectedAnalysisHash

`string`

#### Returns

`Promise`\<[`GrowthReportRecord`](/api/admin-core/src/type-aliases/growthreportrecord/)\>

---
editUrl: false
next: false
prev: false
title: "TargetingImpactReportStore"
---

## Methods

### get()

> **get**(`scope`, `id`): `Promise`\<`string` \| `undefined`\>

#### Parameters

##### scope

[`ReplayScope`](/api/admin-core/src/type-aliases/replayscope/)

##### id

`string`

#### Returns

`Promise`\<`string` \| `undefined`\>

---

### put()

> **put**(`scope`, `id`, `serialized`): `Promise`\<`void`\>

Insert only. An existing key must contain exactly the same serialized report.

#### Parameters

##### scope

[`ReplayScope`](/api/admin-core/src/type-aliases/replayscope/)

##### id

`string`

##### serialized

`string`

#### Returns

`Promise`\<`void`\>

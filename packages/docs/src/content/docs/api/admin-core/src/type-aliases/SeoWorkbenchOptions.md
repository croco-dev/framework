---
editUrl: false
next: false
prev: false
title: "SeoWorkbenchOptions"
---

> **SeoWorkbenchOptions** = `object`

## Properties

### store

> **store**: `object`

#### delete()

> **delete**(`scope`, `id`, `signal?`): `Promise`\<`void`\>

##### Parameters

###### scope

[`SeoScope`](/api/metrics-core/src/type-aliases/seoscope/)

###### id

`string`

###### signal?

`AbortSignal`

##### Returns

`Promise`\<`void`\>

#### read()

> **read**(`scope`, `id`, `signal?`): `Promise`\<[`SeoSavedReport`](/api/admin-core/src/type-aliases/seosavedreport/) \| `undefined`\>

##### Parameters

###### scope

[`SeoScope`](/api/metrics-core/src/type-aliases/seoscope/)

###### id

`string`

###### signal?

`AbortSignal`

##### Returns

`Promise`\<[`SeoSavedReport`](/api/admin-core/src/type-aliases/seosavedreport/) \| `undefined`\>

#### write()

> **write**(`scope`, `record`, `signal?`): `Promise`\<`void`\>

##### Parameters

###### scope

[`SeoScope`](/api/metrics-core/src/type-aliases/seoscope/)

###### record

[`SeoSavedReport`](/api/admin-core/src/type-aliases/seosavedreport/)

###### signal?

`AbortSignal`

##### Returns

`Promise`\<`void`\>

## Methods

### authenticate()

> **authenticate**(): `Promise`\<[`SeoAccess`](/api/admin-core/src/type-aliases/seoaccess/)\>

#### Returns

`Promise`\<[`SeoAccess`](/api/admin-core/src/type-aliases/seoaccess/)\>

---

### mask()

> **mask**(`field`, `value`, `scope`): `string`

Application field policy. Never send raw page URLs, queries or source references to the browser.

#### Parameters

##### field

`"pageId"` \| `"sourceRef"` \| `"change"`

##### value

`string`

##### scope

[`SeoScope`](/api/metrics-core/src/type-aliases/seoscope/)

#### Returns

`string`

---

### now()

> **now**(): `Date`

#### Returns

`Date`

---

### reader()

> **reader**(`scope`, `definition`, `signal?`): `Promise`\<\{ `queryId`: `string`; `service`: `MetricReadService`; `window`: [`SeoWindow`](/api/metrics-core/src/type-aliases/seowindow/); \}\>

Bind definitions, source revisions and raw loader to registerSeoQuery + the shared MetricReadService.

#### Parameters

##### scope

[`SeoScope`](/api/metrics-core/src/type-aliases/seoscope/)

##### definition

[`SeoDefinition`](/api/metrics-core/src/type-aliases/seodefinition/)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<\{ `queryId`: `string`; `service`: `MetricReadService`; `window`: [`SeoWindow`](/api/metrics-core/src/type-aliases/seowindow/); \}\>

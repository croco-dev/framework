---
editUrl: false
next: false
prev: false
title: "createSeoWorkbench"
---

> **createSeoWorkbench**(`options`): `object`

Scope is resolved on the server for every operation, including exports and retained report reads.

## Parameters

### options

[`SeoWorkbenchOptions`](/api/admin-core/src/type-aliases/seoworkbenchoptions/)

## Returns

`object`

### delete()

> **delete**(`id`, `signal?`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

### export()

> **export**(`definition`, `expectedInputHash`, `signal?`): `Promise`\<`string`\>

#### Parameters

##### definition

[`SeoDefinition`](/api/metrics-core/src/type-aliases/seodefinition/)

##### expectedInputHash

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`string`\>

### read()

> **read**(`definition`, `offset?`, `limit?`, `signal?`): `Promise`\<[`SeoWorkbenchState`](/api/admin-core/src/type-aliases/seoworkbenchstate/)\>

#### Parameters

##### definition

[`SeoDefinition`](/api/metrics-core/src/type-aliases/seodefinition/)

##### offset?

`number` = `0`

##### limit?

`number` = `25`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`SeoWorkbenchState`](/api/admin-core/src/type-aliases/seoworkbenchstate/)\>

### readSaved()

> **readSaved**(`id`, `offset?`, `limit?`, `signal?`): `Promise`\<[`SeoWorkbenchState`](/api/admin-core/src/type-aliases/seoworkbenchstate/)\>

#### Parameters

##### id

`string`

##### offset?

`number` = `0`

##### limit?

`number` = `25`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`SeoWorkbenchState`](/api/admin-core/src/type-aliases/seoworkbenchstate/)\>

### save()

> **save**(`id`, `definition`, `expectedInputHash`, `expiresAt`, `signal?`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

##### definition

[`SeoDefinition`](/api/metrics-core/src/type-aliases/seodefinition/)

##### expectedInputHash

`string`

##### expiresAt

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

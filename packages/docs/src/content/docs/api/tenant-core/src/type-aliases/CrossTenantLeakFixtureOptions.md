---
editUrl: false
next: false
prev: false
title: "CrossTenantLeakFixtureOptions"
---

> **CrossTenantLeakFixtureOptions**\<`TRecord`\> = `object`

## Type Parameters

### TRecord

`TRecord` *extends* [`CrossTenantLeakFixtureRecord`](/api/tenant-core/src/type-aliases/crosstenantleakfixturerecord/)

## Properties

### createRecord?

> `readonly` `optional` **createRecord?**: (`tenantId`, `index`) => `TRecord`

#### Parameters

##### tenantId

`string`

##### index

`number`

#### Returns

`TRecord`

***

### operation

> `readonly` **operation**: `string`

***

### recordsPerTenant?

> `readonly` `optional` **recordsPerTenant?**: `number`

***

### tenantIds?

> `readonly` `optional` **tenantIds?**: readonly \[`string`, `string`, `...string[]`\]

***

### tenantKey?

> `readonly` `optional` **tenantKey?**: keyof `TRecord` & `string`

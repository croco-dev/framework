---
editUrl: false
next: false
prev: false
title: "CrossTenantLeakFixture"
---

> **CrossTenantLeakFixture**\<`TRecord`\> = `object`

## Type Parameters

### TRecord

`TRecord` *extends* [`CrossTenantLeakFixtureRecord`](/api/tenant-core/src/type-aliases/crosstenantleakfixturerecord/)

## Properties

### operation

> `readonly` **operation**: `string`

***

### records

> `readonly` **records**: readonly `TRecord`[]

***

### tenantIds

> `readonly` **tenantIds**: readonly `string`[]

***

### tenantKey

> `readonly` **tenantKey**: keyof `TRecord` & `string`

## Methods

### assertNoCrossTenantRows()

> **assertNoCrossTenantRows**(`tenantId`, `rows`): `void`

#### Parameters

##### tenantId

`string`

##### rows

readonly `TRecord`[]

#### Returns

`void`

***

### expectedRowsForTenant()

> **expectedRowsForTenant**(`tenantId`): readonly `TRecord`[]

#### Parameters

##### tenantId

`string`

#### Returns

readonly `TRecord`[]

---
editUrl: false
next: false
prev: false
title: "MetricsPostgresClient"
---

Minimal query contract used by the PostgreSQL metrics integration.

`pg.Pool`, `pg.Client`, and compatible transaction-scoped clients satisfy this interface.

## Methods

### query()

> **query**\<`T`\>(`sql`, `params?`): `Promise`\<\{ `rows`: `T`[]; \}\>

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### sql

`string`

##### params?

`unknown`[]

#### Returns

`Promise`\<\{ `rows`: `T`[]; \}\>

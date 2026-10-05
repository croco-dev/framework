---
editUrl: false
next: false
prev: false
title: "ExplorerPgDatabase"
---

## Extends

- [`ExplorerPgExecutor`](/api/admin-ops/src/interfaces/explorerpgexecutor/)

## Methods

### connect()

> **connect**(): `Promise`\<[`ExplorerPgExecutor`](/api/admin-ops/src/interfaces/explorerpgexecutor/) & `object`\>

#### Returns

`Promise`\<[`ExplorerPgExecutor`](/api/admin-ops/src/interfaces/explorerpgexecutor/) & `object`\>

---

### query()

> **query**(`text`, `values?`): `Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Parameters

##### text

`string`

##### values?

`unknown`[]

#### Returns

`Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Inherited from

[`ExplorerPgExecutor`](/api/admin-ops/src/interfaces/explorerpgexecutor/).[`query`](/api/admin-ops/src/interfaces/explorerpgexecutor/#query)

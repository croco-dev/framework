---
editUrl: false
next: false
prev: false
title: "FactHistoryDatabase"
---

## Extends

- [`FactHistoryConnection`](/api/analytics-drizzle/src/interfaces/facthistoryconnection/)

## Methods

### execute()

> **execute**(`query`): `Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Parameters

##### query

`SQL`

#### Returns

`Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Inherited from

[`FactHistoryConnection`](/api/analytics-drizzle/src/interfaces/facthistoryconnection/).[`execute`](/api/analytics-drizzle/src/interfaces/facthistoryconnection/#execute)

---

### transaction()

> **transaction**\<`T`\>(`callback`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### callback

(`tx`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

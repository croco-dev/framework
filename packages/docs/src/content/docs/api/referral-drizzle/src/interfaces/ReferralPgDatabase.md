---
editUrl: false
next: false
prev: false
title: "ReferralPgDatabase"
---

## Extends

- [`ReferralPgExecutor`](/api/referral-drizzle/src/interfaces/referralpgexecutor/)

## Methods

### execute()

> **execute**(`query`): `Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Parameters

##### query

`SQL`

#### Returns

`Promise`\<\{ `rows`: `Record`\<`string`, `unknown`\>[]; \}\>

#### Inherited from

[`ReferralPgExecutor`](/api/referral-drizzle/src/interfaces/referralpgexecutor/).[`execute`](/api/referral-drizzle/src/interfaces/referralpgexecutor/#execute)

---

### transaction()

> **transaction**\<`T`\>(`work`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### work

(`tx`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

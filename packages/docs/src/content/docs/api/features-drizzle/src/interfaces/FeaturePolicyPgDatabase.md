---
editUrl: false
next: false
prev: false
title: "FeaturePolicyPgDatabase"
---

## Extends

- [`FeaturePolicyPgExecutor`](/api/features-drizzle/src/interfaces/featurepolicypgexecutor/)

## Methods

### execute()

> **execute**(`query`): `PromiseLike`\<`QueryResult`\>

#### Parameters

##### query

`SQL`

#### Returns

`PromiseLike`\<`QueryResult`\>

#### Inherited from

[`FeaturePolicyPgExecutor`](/api/features-drizzle/src/interfaces/featurepolicypgexecutor/).[`execute`](/api/features-drizzle/src/interfaces/featurepolicypgexecutor/#execute)

---

### transaction()

> **transaction**\<`T`\>(`work`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### work

(`transaction`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

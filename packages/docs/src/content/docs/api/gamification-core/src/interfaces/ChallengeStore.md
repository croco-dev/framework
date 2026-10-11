---
editUrl: false
next: false
prev: false
title: "ChallengeStore"
---

Durably serializes one full scoped challenge, including concurrent creation. Rolls back on failure.

## Methods

### transact()

> **transact**\<`T`\>(`scope`, `challengeId`, `operation`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

[`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/)

##### challengeId

`string`

##### operation

(`transaction`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

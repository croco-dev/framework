---
editUrl: false
next: false
prev: false
title: "DrizzleChallengeStore"
---

Durably serializes one full scoped challenge, including concurrent creation. Rolls back on failure.

## Implements

- [`ChallengeStore`](/api/gamification-core/src/interfaces/challengestore/)

## Constructors

### Constructor

> **new DrizzleChallengeStore**(`db`): `DrizzleChallengeStore`

#### Parameters

##### db

[`DrizzleChallengeClient`](/api/gamification-drizzle/src/type-aliases/drizzlechallengeclient/)

#### Returns

`DrizzleChallengeStore`

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

#### Implementation of

[`ChallengeStore`](/api/gamification-core/src/interfaces/challengestore/).[`transact`](/api/gamification-core/src/interfaces/challengestore/#transact)

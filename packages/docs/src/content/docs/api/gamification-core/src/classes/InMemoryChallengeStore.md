---
editUrl: false
next: false
prev: false
title: "InMemoryChallengeStore"
---

Development/test adapter. Each transaction commits a detached snapshot or rolls back entirely.

## Implements

- [`ChallengeStore`](/api/gamification-core/src/interfaces/challengestore/)

## Constructors

### Constructor

> **new InMemoryChallengeStore**(): `InMemoryChallengeStore`

#### Returns

`InMemoryChallengeStore`

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

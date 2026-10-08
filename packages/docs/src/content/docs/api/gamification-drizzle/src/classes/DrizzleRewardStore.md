---
editUrl: false
next: false
prev: false
title: "DrizzleRewardStore"
---

## Extends

- [`RewardStore`](/api/gamification-core/src/classes/rewardstore/)

## Constructors

### Constructor

> **new DrizzleRewardStore**(`db`): `DrizzleRewardStore`

#### Parameters

##### db

[`DrizzleRewardClient`](/api/gamification-drizzle/src/type-aliases/drizzlerewardclient/)

#### Returns

`DrizzleRewardStore`

#### Overrides

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/).[`constructor`](/api/gamification-core/src/classes/rewardstore/#constructor)

## Methods

### getAccount()

> **getAccount**(`scope`, `subject`): `Promise`\<[`RewardAccount`](/api/gamification-core/src/type-aliases/rewardaccount/)\>

#### Parameters

##### scope

[`RewardScope`](/api/gamification-core/src/type-aliases/rewardscope/)

##### subject

`string`

#### Returns

`Promise`\<[`RewardAccount`](/api/gamification-core/src/type-aliases/rewardaccount/)\>

#### Overrides

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/).[`getAccount`](/api/gamification-core/src/classes/rewardstore/#getaccount)

---

### getPolicy()

> **getPolicy**(`scope`, `policyId`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

#### Parameters

##### scope

[`RewardScope`](/api/gamification-core/src/type-aliases/rewardscope/)

##### policyId

`string`

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

#### Overrides

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/).[`getPolicy`](/api/gamification-core/src/classes/rewardstore/#getpolicy)

---

### publish()

> **publish**(`publication`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

#### Parameters

##### publication

[`RewardPublication`](/api/gamification-core/src/type-aliases/rewardpublication/)

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

#### Overrides

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/).[`publish`](/api/gamification-core/src/classes/rewardstore/#publish)

---

### reserve()

> **reserve**(`key`, `select`): `Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

Serialize the family cap and logical key; invoke select only for a new, eligible grant.

#### Parameters

##### key

[`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/)

##### select

(`publication`, `depleted`) => [`RewardSelection`](/api/gamification-core/src/type-aliases/rewardselection/)

#### Returns

`Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

#### Overrides

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/).[`reserve`](/api/gamification-core/src/classes/rewardstore/#reserve)

---

### settle()

> **settle**(`key`): `Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

Atomically append the point entry or unique badge ownership and settle the persisted selection.

#### Parameters

##### key

[`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/)

#### Returns

`Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

#### Overrides

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/).[`settle`](/api/gamification-core/src/classes/rewardstore/#settle)

---
editUrl: false
next: false
prev: false
title: "RewardStore"
---

## Extended by

- [`DrizzleRewardStore`](/api/gamification-drizzle/src/classes/drizzlerewardstore/)

## Constructors

### Constructor

> **new RewardStore**(): `RewardStore`

#### Returns

`RewardStore`

## Methods

### getAccount()

> `abstract` **getAccount**(`scope`, `subject`): `Promise`\<[`RewardAccount`](/api/gamification-core/src/type-aliases/rewardaccount/)\>

#### Parameters

##### scope

[`RewardScope`](/api/gamification-core/src/type-aliases/rewardscope/)

##### subject

`string`

#### Returns

`Promise`\<[`RewardAccount`](/api/gamification-core/src/type-aliases/rewardaccount/)\>

---

### getPolicy()

> `abstract` **getPolicy**(`scope`, `policyId`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

#### Parameters

##### scope

[`RewardScope`](/api/gamification-core/src/type-aliases/rewardscope/)

##### policyId

`string`

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

---

### publish()

> `abstract` **publish**(`publication`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

#### Parameters

##### publication

[`RewardPublication`](/api/gamification-core/src/type-aliases/rewardpublication/)

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

---

### reserve()

> `abstract` **reserve**(`key`, `select`): `Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

Serialize the family cap and logical key; invoke select only for a new, eligible grant.

#### Parameters

##### key

[`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/)

##### select

(`publication`, `depleted`) => [`RewardSelection`](/api/gamification-core/src/type-aliases/rewardselection/)

#### Returns

`Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

---

### settle()

> `abstract` **settle**(`key`): `Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

Atomically append the point entry or unique badge ownership and settle the persisted selection.

#### Parameters

##### key

[`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/)

#### Returns

`Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

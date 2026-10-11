---
editUrl: false
next: false
prev: false
title: "RewardService"
---

## Constructors

### Constructor

> **new RewardService**(`store`, `evidence`, `access`, `random?`): `RewardService`

#### Parameters

##### store

[`RewardStore`](/api/gamification-core/src/classes/rewardstore/)

##### evidence

[`RewardEvidenceVerifier`](/api/gamification-core/src/interfaces/rewardevidenceverifier/)

##### access

[`RewardAccessVerifier`](/api/gamification-core/src/interfaces/rewardaccessverifier/)

##### random?

() => `number`

#### Returns

`RewardService`

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

---

### getPolicy()

> **getPolicy**(`scope`, `policyId`, `subject`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

#### Parameters

##### scope

[`RewardScope`](/api/gamification-core/src/type-aliases/rewardscope/)

##### policyId

`string`

##### subject

`string`

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

---

### grantForEvidence()

> **grantForEvidence**(`key`): `Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

#### Parameters

##### key

[`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/)

#### Returns

`Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

---

### publish()

> **publish**(`publication`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

#### Parameters

##### publication

[`RewardPublication`](/api/gamification-core/src/type-aliases/rewardpublication/)

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

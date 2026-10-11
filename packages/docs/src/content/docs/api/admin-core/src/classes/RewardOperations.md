---
editUrl: false
next: false
prev: false
title: "RewardOperations"
---

Access is resolved from the authenticated server session.

## Constructors

### Constructor

> **new RewardOperations**(`service`): `RewardOperations`

#### Parameters

##### service

[`RewardService`](/api/gamification-core/src/classes/rewardservice/)

#### Returns

`RewardOperations`

## Methods

### getAccount()

> **getAccount**(`subject`, `access`): `Promise`\<[`RewardAccount`](/api/gamification-core/src/type-aliases/rewardaccount/)\>

#### Parameters

##### subject

`string`

##### access

[`RewardAdminAccess`](/api/admin-core/src/type-aliases/rewardadminaccess/)

#### Returns

`Promise`\<[`RewardAccount`](/api/gamification-core/src/type-aliases/rewardaccount/)\>

---

### getPolicy()

> **getPolicy**(`policyId`, `subject`, `access`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

#### Parameters

##### policyId

`string`

##### subject

`string`

##### access

[`RewardAdminAccess`](/api/admin-core/src/type-aliases/rewardadminaccess/)

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/) \| `null`\>

---

### publish()

> **publish**(`input`, `access`): `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

#### Parameters

##### input

[`RewardPublication`](/api/gamification-core/src/type-aliases/rewardpublication/)

##### access

[`RewardAdminAccess`](/api/admin-core/src/type-aliases/rewardadminaccess/)

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

---

### testGrant()

> **testGrant**(`key`, `access`): `Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

#### Parameters

##### key

[`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/)

##### access

[`RewardAdminAccess`](/api/admin-core/src/type-aliases/rewardadminaccess/)

#### Returns

`Promise`\<[`RewardGrant`](/api/gamification-core/src/type-aliases/rewardgrant/)\>

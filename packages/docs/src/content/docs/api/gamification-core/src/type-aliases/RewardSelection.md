---
editUrl: false
next: false
prev: false
title: "RewardSelection"
---

> **RewardSelection** = `object`

## Properties

### entry

> `readonly` **entry**: [`RewardEntry`](/api/gamification-core/src/type-aliases/rewardentry/) \| `null`

---

### receipt

> `readonly` **receipt**: `object`

#### bucket

> `readonly` **bucket**: `number` \| `null`

#### fallback

> `readonly` **fallback**: `boolean`

#### fallbackPolicy

> `readonly` **fallbackPolicy**: [`RewardFallback`](/api/gamification-core/src/type-aliases/rewardfallback/)

#### mode

> `readonly` **mode**: [`RewardPolicy`](/api/gamification-core/src/type-aliases/rewardpolicy/)\[`"mode"`\]

#### policyVersion

> `readonly` **policyVersion**: `string`

#### revision

> `readonly` **revision**: `number`

#### weights

> `readonly` **weights**: readonly `number`[]

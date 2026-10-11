---
editUrl: false
next: false
prev: false
title: "RewardGrant"
---

> **RewardGrant** = [`RewardKey`](/api/gamification-core/src/type-aliases/rewardkey/) & `object`

## Type Declaration

### createdAt

> `readonly` **createdAt**: `string`

### id

> `readonly` **id**: `string`

### rejection

> `readonly` **rejection**: `"no-reward"` \| `"badge-owned"` \| `null`

### selection

> `readonly` **selection**: [`RewardSelection`](/api/gamification-core/src/type-aliases/rewardselection/)

### state

> `readonly` **state**: `"reserved"` \| `"granted"` \| `"rejected"` \| `"indeterminate"`

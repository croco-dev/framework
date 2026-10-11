---
editUrl: false
next: false
prev: false
title: "RewardConsoleProps"
---

> **RewardConsoleProps** = `object`

## Properties

### access

> `readonly` **access**: [`RewardAdminAccess`](/api/admin-core/src/type-aliases/rewardadminaccess/)

---

### onPublish

> `readonly` **onPublish**: (`input`) => `Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

#### Parameters

##### input

[`RewardPublication`](/api/gamification-core/src/type-aliases/rewardpublication/)

#### Returns

`Promise`\<[`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)\>

---

### publication

> `readonly` **publication**: [`PublishedRewardPolicy`](/api/gamification-core/src/type-aliases/publishedrewardpolicy/)

---

### state?

> `readonly` `optional` **state?**: \{ `kind`: `"loading"`; \} \| \{ `kind`: `"empty"`; \} \| \{ `kind`: `"denied"` \| `"error"` \| `"partial"`; `message`: `string`; `reload?`: () => `void`; \}

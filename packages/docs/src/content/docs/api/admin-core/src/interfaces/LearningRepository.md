---
editUrl: false
next: false
prev: false
title: "LearningRepository"
---

commit atomically performs CAS, receipt conflict/replay, full revision history and audit.

## Methods

### commit()

> **commit**(`command`): `Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)\>

#### Parameters

##### command

[`LearningCommit`](/api/admin-core/src/type-aliases/learningcommit/)

#### Returns

`Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)\>

---

### history()

> **history**(`scope`, `id`, `before`, `limit`): `Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `reason`: `string`; `record`: [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/); \}\>[]\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

##### before

`number` \| `undefined`

##### limit

`number`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `reason`: `string`; `record`: [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/); \}\>[]\>

---

### page()

> **page**(`scope`, `after`, `limit`): `Promise`\<readonly [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)[]\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### after

`string` \| `undefined`

##### limit

`number`

#### Returns

`Promise`\<readonly [`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)[]\>

---

### read()

> **read**(`scope`, `id`): `Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/) \| `undefined`\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

#### Returns

`Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/) \| `undefined`\>

---
editUrl: false
next: false
prev: false
title: "BetterAuthWebhookHandler"
---

> **BetterAuthWebhookHandler** = `object`

Better Auth 이벤트 타입별 웹훅 핸들러 맵입니다.

## Properties

### session.created?

> `optional` **session.created?**: (`data`) => `Promise`\<`void`\>

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

---

### session.revoked?

> `optional` **session.revoked?**: (`data`) => `Promise`\<`void`\>

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

---

### user.created?

> `optional` **user.created?**: (`data`) => `Promise`\<`void`\>

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

---

### user.deleted?

> `optional` **user.deleted?**: (`data`) => `Promise`\<`void`\>

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

---

### user.updated?

> `optional` **user.updated?**: (`data`) => `Promise`\<`void`\>

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

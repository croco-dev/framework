---
editUrl: false
next: false
prev: false
title: "CancellationStore"
---

Implementations atomically compare revisions and persist the complete session, including decision and command reservation. A missing resource is never a global lookup.

## Methods

### createSession()

> **createSession**(`session`): `Promise`\<`void`\>

#### Parameters

##### session

[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)

#### Returns

`Promise`\<`void`\>

---

### getPolicy()

> **getPolicy**(`scope`): `Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/) \| `undefined`\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

#### Returns

`Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/) \| `undefined`\>

---

### getSession()

> **getSession**(`scope`, `id`): `Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/) \| `undefined`\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

##### id

`string`

#### Returns

`Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/) \| `undefined`\>

---

### listSessions()

> **listSessions**(`scope`): `Promise`\<readonly [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)[]\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

#### Returns

`Promise`\<readonly [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)[]\>

---

### savePolicy()

> **savePolicy**(`policy`, `audit`): `Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)\>

Atomically deduplicates audit idempotency keys, verifies expectedRevision, and stores policy plus audit. Conflicting key reuse throws.

#### Parameters

##### policy

[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)

##### audit

[`ChoicePolicyAudit`](/api/billing-core/src/type-aliases/choicepolicyaudit/)

#### Returns

`Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)\>

---

### saveSession()

> **saveSession**(`session`, `expectedRevision`): `Promise`\<`boolean`\>

#### Parameters

##### session

[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)

##### expectedRevision

`number`

#### Returns

`Promise`\<`boolean`\>

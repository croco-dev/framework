---
editUrl: false
next: false
prev: false
title: "DrizzleCancellationStore"
---

Scoped cancellation sessions and atomic policy/audit writes in PostgreSQL.

## Implements

- [`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/)

## Constructors

### Constructor

> **new DrizzleCancellationStore**(`db`): `DrizzleCancellationStore`

#### Parameters

##### db

`BillingDatabase`

#### Returns

`DrizzleCancellationStore`

## Methods

### createSession()

> **createSession**(`session`): `Promise`\<`void`\>

#### Parameters

##### session

[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/).[`createSession`](/api/billing-core/src/interfaces/cancellationstore/#createsession)

---

### getPolicy()

> **getPolicy**(`scope`): `Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/) \| `undefined`\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

#### Returns

`Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/) \| `undefined`\>

#### Implementation of

[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/).[`getPolicy`](/api/billing-core/src/interfaces/cancellationstore/#getpolicy)

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

#### Implementation of

[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/).[`getSession`](/api/billing-core/src/interfaces/cancellationstore/#getsession)

---

### listSessions()

> **listSessions**(`scope`): `Promise`\<readonly [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)[]\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

#### Returns

`Promise`\<readonly [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)[]\>

#### Implementation of

[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/).[`listSessions`](/api/billing-core/src/interfaces/cancellationstore/#listsessions)

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

#### Implementation of

[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/).[`savePolicy`](/api/billing-core/src/interfaces/cancellationstore/#savepolicy)

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

#### Implementation of

[`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/).[`saveSession`](/api/billing-core/src/interfaces/cancellationstore/#savesession)

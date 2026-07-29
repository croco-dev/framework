---
editUrl: false
next: false
prev: false
title: "TransactionContext"
---

## Methods

### canRegisterAfterCommit()

> **canRegisterAfterCommit**(): `boolean`

Whether the active callback still accepts hooks and preserves their delivery evidence.

#### Returns

`boolean`

---

### isInTransaction()

> **isInTransaction**(): `boolean`

#### Returns

`boolean`

---

### onAfterCommit()

> **onAfterCommit**(`hook`): `void`

#### Parameters

##### hook

() => `void` \| `Promise`\<`void`\>

#### Returns

`void`

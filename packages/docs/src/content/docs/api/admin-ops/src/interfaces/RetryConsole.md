---
editUrl: false
next: false
prev: false
title: "RetryConsole"
---

## Methods

### list()

> **list**(`options?`): `Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

#### Parameters

##### options?

[`RetryConsoleListOptions`](/api/admin-ops/src/type-aliases/retryconsolelistoptions/)

#### Returns

`Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

---

### recover()

> **recover**(`request`): `Promise`\<[`RetryConsoleRecoveryResult`](/api/admin-ops/src/type-aliases/retryconsolerecoveryresult/)\>

#### Parameters

##### request

[`RetryConsoleRecoveryInput`](/api/admin-ops/src/type-aliases/retryconsolerecoveryinput/)

#### Returns

`Promise`\<[`RetryConsoleRecoveryResult`](/api/admin-ops/src/type-aliases/retryconsolerecoveryresult/)\>

---

### show()

> **show**(`itemId`): `Promise`\<[`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/) \| `null`\>

#### Parameters

##### itemId

`string`

#### Returns

`Promise`\<[`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/) \| `null`\>

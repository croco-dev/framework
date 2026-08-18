---
editUrl: false
next: false
prev: false
title: "RetryConsoleSource"
---

## Properties

### kind

> `readonly` **kind**: [`RetryConsoleSourceKind`](/api/admin-ops/src/type-aliases/retryconsolesourcekind/)

## Methods

### list()

> **list**(`options?`): `Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

#### Parameters

##### options?

[`RetryConsoleListOptions`](/api/admin-ops/src/type-aliases/retryconsolelistoptions/)

#### Returns

`Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

***

### recover()

> **recover**(`item`, `request`, `action`): `Promise`\<[`RetryConsoleSourceRecoveryResult`](/api/admin-ops/src/type-aliases/retryconsolesourcerecoveryresult/)\>

#### Parameters

##### item

[`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)

##### request

[`RetryConsoleRecoveryInput`](/api/admin-ops/src/type-aliases/retryconsolerecoveryinput/)

##### action

[`RetryConsoleRecoveryAction`](/api/admin-ops/src/type-aliases/retryconsolerecoveryaction/)

#### Returns

`Promise`\<[`RetryConsoleSourceRecoveryResult`](/api/admin-ops/src/type-aliases/retryconsolesourcerecoveryresult/)\>

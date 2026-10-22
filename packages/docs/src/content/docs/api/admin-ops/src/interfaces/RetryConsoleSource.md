---
editUrl: false
next: false
prev: false
title: "RetryConsoleSource"
---

## Properties

### kind

> `readonly` **kind**: [`RetryConsoleSourceKind`](/api/admin-ops/src/type-aliases/retryconsolesourcekind/)

---

### replayIdempotency?

> `readonly` `optional` **replayIdempotency?**: `"provider"`

Delegate every replay request to a provider that atomically validates its durable key and intent.
When omitted, the console retains in-flight coalescing; the provider still owns durable safety.

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

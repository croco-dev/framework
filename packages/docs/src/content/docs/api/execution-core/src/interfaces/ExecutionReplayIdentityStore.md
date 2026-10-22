---
editUrl: false
next: false
prev: false
title: "ExecutionReplayIdentityStore"
---

Optional capability for atomically binding an existing replay to its durable identity.
Preserve every other field. Return the record only when its key is unassigned or already
matches both requested values; return null for a different binding or a missing record.
Enforce the same global key uniqueness as create(), including concurrent creates/claims.
A conflicting unique write throws an idempotency-conflict Problem; a caller-owned transaction
must roll back before retrying. Never overwrite another binding or start a separate transaction.

## Methods

### claimReplayIdentity()

> **claimReplayIdentity**(`id`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Parameters

##### id

`string`

##### input

[`ClaimExecutionReplayIdentityInput`](/api/execution-core/src/type-aliases/claimexecutionreplayidentityinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

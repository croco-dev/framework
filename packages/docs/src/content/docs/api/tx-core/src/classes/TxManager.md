---
editUrl: false
next: false
prev: false
title: "TxManager"
---

AsyncLocalStorage 기반으로 현재 트랜잭션 컨텍스트를 관리하는 매니저입니다.

## Type Parameters

### TClient

`TClient`

### TOptions

`TOptions` = `unknown`

## Implements

- [`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/)

## Constructors

### Constructor

> **new TxManager**\<`TClient`, `TOptions`\>(`adapter`, `config?`): `TxManager`\<`TClient`, `TOptions`\>

#### Parameters

##### adapter

[`TxAdapter`](/api/tx-core/src/interfaces/txadapter/)\<`TClient`, `TOptions`\>

##### config?

[`TxManagerConfig`](/api/tx-core/src/interfaces/txmanagerconfig/)

#### Returns

`TxManager`\<`TClient`, `TOptions`\>

## Methods

### canRegisterAfterCommit()

> **canRegisterAfterCommit**(): `boolean`

Whether the active callback still accepts hooks and preserves their delivery evidence.

#### Returns

`boolean`

#### Implementation of

[`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/).[`canRegisterAfterCommit`](/api/framework-context/src/interfaces/transactioncontext/#canregisteraftercommit)

---

### getClient()

> **getClient**(): `TClient` \| `null`

#### Returns

`TClient` \| `null`

---

### isInTransaction()

> **isInTransaction**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/).[`isInTransaction`](/api/framework-context/src/interfaces/transactioncontext/#isintransaction)

---

### onAfterCommit()

> **onAfterCommit**(`hook`): `void`

#### Parameters

##### hook

[`AfterCommitHook`](/api/tx-core/src/type-aliases/aftercommithook/)

#### Returns

`void`

#### Implementation of

[`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/).[`onAfterCommit`](/api/framework-context/src/interfaces/transactioncontext/#onaftercommit)

---

### run()

> **run**\<`T`\>(`fn`, `runOptions?`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

##### runOptions?

[`TxRunOptions`](/api/tx-core/src/interfaces/txrunoptions/)\<`TOptions`\>

#### Returns

`Promise`\<`T`\>

---

### runWithOutcome()

> **runWithOutcome**\<`T`\>(`fn`, `runOptions?`): `Promise`\<[`TxRunOutcome`](/api/tx-core/src/type-aliases/txrunoutcome/)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

##### runOptions?

[`TxRunOptions`](/api/tx-core/src/interfaces/txrunoptions/)\<`TOptions`\>

#### Returns

`Promise`\<[`TxRunOutcome`](/api/tx-core/src/type-aliases/txrunoutcome/)\<`T`\>\>

---

### suspend()

> **suspend**\<`T`\>(`fn`): `Promise`\<`T`\>

Suspend current transaction context and run function outside of it.
Used for REQUIRES_NEW propagation to ensure clean transaction state.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

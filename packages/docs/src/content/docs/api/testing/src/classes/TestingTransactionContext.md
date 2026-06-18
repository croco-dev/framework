---
editUrl: false
next: false
prev: false
title: "TestingTransactionContext"
---

## Implements

- [`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/)

## Constructors

### Constructor

> **new TestingTransactionContext**(`options?`): `TestingTransactionContext`

#### Parameters

##### options?

[`TestingTransactionContextOptions`](/api/testing/src/type-aliases/testingtransactioncontextoptions/) = `{}`

#### Returns

`TestingTransactionContext`

## Methods

### flushAfterCommitHooks()

> **flushAfterCommitHooks**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### getPendingAfterCommitHookCount()

> **getPendingAfterCommitHookCount**(): `number`

#### Returns

`number`

***

### isInTransaction()

> **isInTransaction**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/).[`isInTransaction`](/api/framework-context/src/interfaces/transactioncontext/#isintransaction)

***

### onAfterCommit()

> **onAfterCommit**(`hook`): `void`

#### Parameters

##### hook

`AfterCommitHook`

#### Returns

`void`

#### Implementation of

[`TransactionContext`](/api/framework-context/src/interfaces/transactioncontext/).[`onAfterCommit`](/api/framework-context/src/interfaces/transactioncontext/#onaftercommit)

***

### runInTransaction()

> **runInTransaction**\<`T`\>(`fn`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T` \| `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

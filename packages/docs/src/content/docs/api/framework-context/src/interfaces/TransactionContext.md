---
editUrl: false
next: false
prev: false
title: "TransactionContext"
---

Defined in: [packages/framework-context/src/libs/TransactionContext.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/TransactionContext.ts#L6)

## Methods

### isInTransaction()

> **isInTransaction**(): `boolean`

Defined in: [packages/framework-context/src/libs/TransactionContext.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/TransactionContext.ts#L7)

#### Returns

`boolean`

***

### onAfterCommit()

> **onAfterCommit**(`hook`): `void`

Defined in: [packages/framework-context/src/libs/TransactionContext.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/TransactionContext.ts#L8)

#### Parameters

##### hook

() => `void` \| `Promise`\<`void`\>

#### Returns

`void`

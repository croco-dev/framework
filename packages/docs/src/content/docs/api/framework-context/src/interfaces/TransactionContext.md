---
editUrl: false
next: false
prev: false
title: "TransactionContext"
---

Defined in: [packages/framework-context/src/libs/TransactionContext.ts:3](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/TransactionContext.ts#L3)

## Methods

### isInTransaction()

> **isInTransaction**(): `boolean`

Defined in: [packages/framework-context/src/libs/TransactionContext.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/TransactionContext.ts#L4)

#### Returns

`boolean`

***

### onAfterCommit()

> **onAfterCommit**(`hook`): `void`

Defined in: [packages/framework-context/src/libs/TransactionContext.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/TransactionContext.ts#L5)

#### Parameters

##### hook

() => `void` \| `Promise`\<`void`\>

#### Returns

`void`

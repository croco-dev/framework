---
editUrl: false
next: false
prev: false
title: "Guard"
---

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:9](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/Guard.ts#L9)

Guard interface and execution context type.

## Type Parameters

### TContext

`TContext` = `unknown`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean` \| `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/Guard.ts#L10)

#### Parameters

##### context

`TContext`

#### Returns

`boolean` \| `Promise`\<`boolean`\>

---
editUrl: false
next: false
prev: false
title: "RouteExecutionContext"
---

> **RouteExecutionContext** = `object`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:3](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/Guard.ts#L3)

Guard interface and execution context type.

## Methods

### getClass()

> **getClass**(): `unknown`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:4](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/Guard.ts#L4)

#### Returns

`unknown`

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:5](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/Guard.ts#L5)

#### Returns

`string` \| `symbol`

***

### getRequest()

> **getRequest**(): [`AuthRequest`](/api/auth-core/src/type-aliases/authrequest/)

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:6](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/Guard.ts#L6)

#### Returns

[`AuthRequest`](/api/auth-core/src/type-aliases/authrequest/)

---
editUrl: false
next: false
prev: false
title: "RouteExecutionContext"
---

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/interfaces/Guard.ts#L6)

Execution context type for route guards.

## Methods

### getClass()

> **getClass**(): `object`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/interfaces/Guard.ts#L7)

#### Returns

`object`

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/interfaces/Guard.ts#L8)

#### Returns

`string` \| `symbol`

***

### getRequest()

> **getRequest**(): [`AuthRequest`](/api/auth-core/src/type-aliases/authrequest/)

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/interfaces/Guard.ts#L9)

#### Returns

[`AuthRequest`](/api/auth-core/src/type-aliases/authrequest/)

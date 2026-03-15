---
editUrl: false
next: false
prev: false
title: "GuardContext"
---

> **GuardContext** = [`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/) & `object`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:28](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L28)

Execution context interface for guard.
Compatible with protocols-rest ExecutionContext.

## Type Declaration

### getHandler()

> **getHandler**(): (...`args`) => `unknown`

The handler method being invoked

#### Returns

> (...`args`): `unknown`

##### Parameters

###### args

...`unknown`[]

##### Returns

`unknown`

### set()

> **set**\<`T`\>(`key`, `value`): `void`

Set a value in the context (for passing result to middleware)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

#### Returns

`void`

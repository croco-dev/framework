---
editUrl: false
next: false
prev: false
title: "GuardContext"
---

> **GuardContext** = [`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/) & `object`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:24](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L24)

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

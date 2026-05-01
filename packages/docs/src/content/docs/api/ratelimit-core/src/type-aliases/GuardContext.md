---
editUrl: false
next: false
prev: false
title: "GuardContext"
---

> **GuardContext** = [`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/) & `object`

라우트 실행 시 레이트 리밋을 검사하는 가드와 메타데이터 타입입니다.

## Type Declaration

### getHandler()

> **getHandler**(): (...`args`) => `unknown`

#### Returns

> (...`args`): `unknown`

##### Parameters

###### args

...`unknown`[]

##### Returns

`unknown`

### set()

> **set**\<`T`\>(`key`, `value`): `void`

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

---
editUrl: false
next: false
prev: false
title: "CompiledRoute"
---

Defined in: [packages/transports-http/src/libs/types.ts:55](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L55)

transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.

## Properties

### controllerInstance?

> `optional` **controllerInstance**: `unknown`

Defined in: [packages/transports-http/src/libs/types.ts:59](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L59)

***

### handler()

> **handler**: (`ctx`) => `Promise`\<`unknown`\>

Defined in: [packages/transports-http/src/libs/types.ts:58](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L58)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Promise`\<`unknown`\>

***

### method

> **method**: `string`

Defined in: [packages/transports-http/src/libs/types.ts:56](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L56)

***

### methodName

> **methodName**: `string` \| `symbol`

Defined in: [packages/transports-http/src/libs/types.ts:60](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L60)

***

### path

> **path**: `string`

Defined in: [packages/transports-http/src/libs/types.ts:57](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L57)

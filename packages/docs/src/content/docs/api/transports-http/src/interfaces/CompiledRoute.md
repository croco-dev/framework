---
editUrl: false
next: false
prev: false
title: "CompiledRoute"
---

Defined in: [packages/transports-http/src/libs/types.ts:49](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L49)

transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.

## Properties

### controllerInstance?

> `optional` **controllerInstance**: `unknown`

Defined in: [packages/transports-http/src/libs/types.ts:53](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L53)

***

### handler()

> **handler**: (`ctx`) => `Promise`\<`unknown`\>

Defined in: [packages/transports-http/src/libs/types.ts:52](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L52)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Promise`\<`unknown`\>

***

### method

> **method**: `string`

Defined in: [packages/transports-http/src/libs/types.ts:50](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L50)

***

### methodName

> **methodName**: `string` \| `symbol`

Defined in: [packages/transports-http/src/libs/types.ts:54](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L54)

***

### path

> **path**: `string`

Defined in: [packages/transports-http/src/libs/types.ts:51](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L51)

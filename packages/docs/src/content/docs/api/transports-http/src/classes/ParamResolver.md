---
editUrl: false
next: false
prev: false
title: "ParamResolver"
---

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:64](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/ParamResolver.ts#L64)

컨트롤러 파라미터 메타데이터를 읽어 실제 메서드 인자 배열로 변환합니다.

## Constructors

### Constructor

> **new ParamResolver**(): `ParamResolver`

#### Returns

`ParamResolver`

## Methods

### resolveParams()

> **resolveParams**(`ctx`, `controller`, `methodName`): `Promise`\<`unknown`[]\>

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:67](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/ParamResolver.ts#L67)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

##### controller

`Constructor`

##### methodName

`string` | `symbol`

#### Returns

`Promise`\<`unknown`[]\>

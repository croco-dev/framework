---
editUrl: false
next: false
prev: false
title: "ParamResolver"
---

컨트롤러 파라미터 메타데이터를 읽어 실제 메서드 인자 배열로 변환합니다.

## Constructors

### Constructor

> **new ParamResolver**(`createPipeInstance?`): `ParamResolver`

#### Parameters

##### createPipeInstance?

(`pipe`) => `PipeTransform`\<`unknown`, `unknown`\> \| `null` \| `undefined`

#### Returns

`ParamResolver`

## Methods

### resolveParams()

> **resolveParams**(`ctx`, `controller`, `methodName`): `Promise`\<`unknown`[]\>

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

##### controller

`Constructor`

##### methodName

`string` | `symbol`

#### Returns

`Promise`\<`unknown`[]\>

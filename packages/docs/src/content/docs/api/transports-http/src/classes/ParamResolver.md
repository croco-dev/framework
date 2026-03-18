---
editUrl: false
next: false
prev: false
title: "ParamResolver"
---

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:23](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/ParamResolver.ts#L23)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new ParamResolver**(): `ParamResolver`

#### Returns

`ParamResolver`

## Methods

### resolveParams()

> **resolveParams**(`ctx`, `controller`, `methodName`): `Promise`\<`unknown`[]\>

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:26](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/ParamResolver.ts#L26)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

##### controller

`Constructor`

##### methodName

`string` | `symbol`

#### Returns

`Promise`\<`unknown`[]\>

---
editUrl: false
next: false
prev: false
title: "ParamResolver"
---

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:23](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/ParamResolver.ts#L23)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new ParamResolver**(): `ParamResolver`

#### Returns

`ParamResolver`

## Methods

### resolveParams()

> **resolveParams**(`ctx`, `controller`, `methodName`): `Promise`\<`unknown`[]\>

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:26](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/ParamResolver.ts#L26)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

##### controller

`Constructor`

##### methodName

`string` | `symbol`

#### Returns

`Promise`\<`unknown`[]\>

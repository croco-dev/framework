---
editUrl: false
next: false
prev: false
title: "ParamResolver"
---

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:22](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/ParamResolver.ts#L22)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new ParamResolver**(): `ParamResolver`

#### Returns

`ParamResolver`

## Methods

### resolveParams()

> **resolveParams**(`ctx`, `controller`, `methodName`): `Promise`\<`unknown`[]\>

Defined in: [packages/transports-http/src/libs/ParamResolver.ts:25](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/ParamResolver.ts#L25)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

##### controller

`Constructor`

##### methodName

`string` | `symbol`

#### Returns

`Promise`\<`unknown`[]\>

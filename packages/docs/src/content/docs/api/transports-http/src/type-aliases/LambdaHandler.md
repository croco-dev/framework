---
editUrl: false
next: false
prev: false
title: "LambdaHandler"
---

> **LambdaHandler** = (`event`, `context`) => `Promise`\<[`LambdaResponse`](/api/transports-http/src/interfaces/lambdaresponse/)\>

Defined in: [packages/transports-http/src/libs/types.ts:74](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/types.ts#L74)

transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.

## Parameters

### event

[`LambdaEvent`](/api/transports-http/src/interfaces/lambdaevent/)

### context

[`LambdaContext`](/api/transports-http/src/interfaces/lambdacontext/)

## Returns

`Promise`\<[`LambdaResponse`](/api/transports-http/src/interfaces/lambdaresponse/)\>

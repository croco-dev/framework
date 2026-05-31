---
editUrl: false
next: false
prev: false
title: "CrocoLambdaAdapter"
---

Hono 앱을 API Gateway v2 형태의 AWS Lambda 핸들러로 연결하는 어댑터입니다.

## Constructors

### Constructor

> **new CrocoLambdaAdapter**(`hono`): `CrocoLambdaAdapter`

#### Parameters

##### hono

`Hono`

#### Returns

`CrocoLambdaAdapter`

## Methods

### createHandler()

> **createHandler**(): [`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

#### Returns

[`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

---

### getExecutionEnv()

> **getExecutionEnv**(`c`): [`LambdaExecutionEnv`](/api/transports-http/src/interfaces/lambdaexecutionenv/)

#### Parameters

##### c

###### env

[`LambdaExecutionEnv`](/api/transports-http/src/interfaces/lambdaexecutionenv/)

#### Returns

[`LambdaExecutionEnv`](/api/transports-http/src/interfaces/lambdaexecutionenv/)

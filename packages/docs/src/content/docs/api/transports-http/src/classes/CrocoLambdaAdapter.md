---
editUrl: false
next: false
prev: false
title: "CrocoLambdaAdapter"
---

Hono 앱을 API Gateway v2 형태의 AWS Lambda 핸들러로 연결하는 어댑터입니다.

## Constructors

### Constructor

> **new CrocoLambdaAdapter**(`dispatcher`): `CrocoLambdaAdapter`

#### Parameters

##### dispatcher

`FetchDispatcher`

#### Returns

`CrocoLambdaAdapter`

## Methods

### createHandler()

> **createHandler**(`options?`): [`LambdaHandler`](/api/preset-lambda/src/type-aliases/lambdahandler/)

#### Parameters

##### options?

[`LambdaHandlerOptions`](/api/transports-http/src/type-aliases/lambdahandleroptions/) = `{}`

#### Returns

[`LambdaHandler`](/api/preset-lambda/src/type-aliases/lambdahandler/)

---

### getExecutionEnv()

> **getExecutionEnv**(`c`): [`LambdaExecutionEnv`](/api/transports-http/src/interfaces/lambdaexecutionenv/)

#### Parameters

##### c

###### env

[`LambdaExecutionEnv`](/api/transports-http/src/interfaces/lambdaexecutionenv/)

#### Returns

[`LambdaExecutionEnv`](/api/transports-http/src/interfaces/lambdaexecutionenv/)

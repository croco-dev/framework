---
editUrl: false
next: false
prev: false
title: "CrocoApp"
---

컨트롤러를 컴파일해 Hono 앱, Lambda 핸들러, Node 서버로 실행하는 HTTP 애플리케이션입니다.

## Constructors

### Constructor

> **new CrocoApp**(`config`, `logger`, `errorHandler`, `healthCheckRegistry`): `CrocoApp`

#### Parameters

##### config

[`AppConfig`](/api/transports-http/src/interfaces/appconfig/)

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

##### errorHandler

[`ErrorHandler`](/api/transports-http/src/classes/errorhandler/)

##### healthCheckRegistry

[`HealthCheckRegistry`](/api/transports-http/src/classes/healthcheckregistry/)

#### Returns

`CrocoApp`

## Methods

### describeBootstrapValidationPolicy()

> **describeBootstrapValidationPolicy**(): [`BootstrapValidationPolicy`](/api/transports-http/src/type-aliases/bootstrapvalidationpolicy/)

#### Returns

[`BootstrapValidationPolicy`](/api/transports-http/src/type-aliases/bootstrapvalidationpolicy/)

***

### describeRequestPipelineGraphs()

> **describeRequestPipelineGraphs**(): readonly [`RequestPipelineGraph`](/api/framework-context/src/type-aliases/requestpipelinegraph/)[]

#### Returns

readonly [`RequestPipelineGraph`](/api/framework-context/src/type-aliases/requestpipelinegraph/)[]

***

### fetch()

> **fetch**(`request`, `runtimeContext?`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

##### runtimeContext?

[`RuntimeContextInit`](/api/transports-http/src/type-aliases/runtimecontextinit/)

##### options?

`FetchRuntimeOptions` = `{}`

#### Returns

`Promise`\<`Response`\>

***

### getHono()

> **getHono**(): `Hono`

#### Returns

`Hono`

***

### lambdaHandler()

> **lambdaHandler**(`options?`): [`LambdaHandler`](/api/preset-lambda/src/type-aliases/lambdahandler/)

#### Parameters

##### options?

[`LambdaHandlerOptions`](/api/transports-http/src/type-aliases/lambdahandleroptions/) = `{}`

#### Returns

[`LambdaHandler`](/api/preset-lambda/src/type-aliases/lambdahandler/)

***

### listen()

> **listen**(`port`, `options?`, `callback?`): `Promise`\<[`NodeServerHandle`](/api/transports-http/src/type-aliases/nodeserverhandle/)\>

#### Parameters

##### port

`number`

##### options?

[`ListenOptions`](/api/transports-http/src/interfaces/listenoptions/) \| (() => `void`)

##### callback?

() => `void`

#### Returns

`Promise`\<[`NodeServerHandle`](/api/transports-http/src/type-aliases/nodeserverhandle/)\>

***

### nodeHandler()

> **nodeHandler**(): [`NodeRequestHandler`](/api/transports-http/src/type-aliases/noderequesthandler/)

#### Returns

[`NodeRequestHandler`](/api/transports-http/src/type-aliases/noderequesthandler/)

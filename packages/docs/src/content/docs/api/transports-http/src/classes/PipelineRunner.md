---
editUrl: false
next: false
prev: false
title: "PipelineRunner"
---

Guard, Interceptor, Filter 체인을 조합해 컨트롤러 핸들러를 실행합니다.

## Constructors

### Constructor

> **new PipelineRunner**(`errorHandler`, `logger?`): `PipelineRunner`

#### Parameters

##### errorHandler

[`ErrorHandler`](/api/transports-http/src/classes/errorhandler/)

##### logger?

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`PipelineRunner`

## Methods

### run()

> **run**(`execContext`, `handler`, `config`): `Promise`\<`unknown`\>

#### Parameters

##### execContext

[`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)

##### handler

() => `Promise`\<`unknown`\>

##### config

[`PipelineConfig`](/api/transports-http/src/interfaces/pipelineconfig/)

#### Returns

`Promise`\<`unknown`\>

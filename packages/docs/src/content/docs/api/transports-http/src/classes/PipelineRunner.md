---
editUrl: false
next: false
prev: false
title: "PipelineRunner"
---

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:33](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/PipelineRunner.ts#L33)

Guard, Interceptor, Filter 체인을 조합해 컨트롤러 핸들러를 실행합니다.

## Constructors

### Constructor

> **new PipelineRunner**(`errorHandler`, `logger`): `PipelineRunner`

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:34](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/PipelineRunner.ts#L34)

#### Parameters

##### errorHandler

[`ErrorHandler`](/api/transports-http/src/classes/errorhandler/)

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`PipelineRunner`

## Methods

### run()

> **run**(`execContext`, `handler`, `config`): `Promise`\<`unknown`\>

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:39](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/PipelineRunner.ts#L39)

#### Parameters

##### execContext

[`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)

##### handler

() => `Promise`\<`unknown`\>

##### config

[`PipelineConfig`](/api/transports-http/src/interfaces/pipelineconfig/)

#### Returns

`Promise`\<`unknown`\>

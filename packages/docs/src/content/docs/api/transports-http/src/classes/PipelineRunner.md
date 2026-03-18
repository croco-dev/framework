---
editUrl: false
next: false
prev: false
title: "PipelineRunner"
---

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:30](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L30)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new PipelineRunner**(`errorHandler`, `logger`): `PipelineRunner`

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:31](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L31)

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

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:36](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L36)

#### Parameters

##### execContext

[`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)

##### handler

() => `Promise`\<`unknown`\>

##### config

[`PipelineConfig`](/api/transports-http/src/interfaces/pipelineconfig/)

#### Returns

`Promise`\<`unknown`\>

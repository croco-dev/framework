---
editUrl: false
next: false
prev: false
title: "PipelineRunner"
---

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:31](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/PipelineRunner.ts#L31)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new PipelineRunner**(): `PipelineRunner`

#### Returns

`PipelineRunner`

## Methods

### run()

> **run**(`execContext`, `handler`, `config`): `Promise`\<`unknown`\>

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:40](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/PipelineRunner.ts#L40)

#### Parameters

##### execContext

[`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)

##### handler

() => `Promise`\<`unknown`\>

##### config

[`PipelineConfig`](/api/transports-http/src/interfaces/pipelineconfig/)

#### Returns

`Promise`\<`unknown`\>

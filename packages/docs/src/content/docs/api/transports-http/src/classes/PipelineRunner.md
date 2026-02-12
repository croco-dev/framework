---
editUrl: false
next: false
prev: false
title: "PipelineRunner"
---

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:12](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/transports-http/src/libs/PipelineRunner.ts#L12)

## Constructors

### Constructor

> **new PipelineRunner**(): `PipelineRunner`

#### Returns

`PipelineRunner`

## Methods

### run()

> **run**(`execContext`, `handler`, `config`): `Promise`\<`unknown`\>

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:15](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/transports-http/src/libs/PipelineRunner.ts#L15)

#### Parameters

##### execContext

[`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)

##### handler

() => `Promise`\<`unknown`\>

##### config

[`PipelineConfig`](/api/transports-http/src/interfaces/pipelineconfig/)

#### Returns

`Promise`\<`unknown`\>

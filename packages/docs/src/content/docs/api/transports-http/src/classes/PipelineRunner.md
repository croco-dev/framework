---
editUrl: false
next: false
prev: false
title: "PipelineRunner"
---

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:30](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/PipelineRunner.ts#L30)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new PipelineRunner**(): `PipelineRunner`

#### Returns

`PipelineRunner`

## Methods

### run()

> **run**(`execContext`, `handler`, `config`): `Promise`\<`unknown`\>

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:35](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/PipelineRunner.ts#L35)

#### Parameters

##### execContext

[`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)

##### handler

() => `Promise`\<`unknown`\>

##### config

[`PipelineConfig`](/api/transports-http/src/interfaces/pipelineconfig/)

#### Returns

`Promise`\<`unknown`\>

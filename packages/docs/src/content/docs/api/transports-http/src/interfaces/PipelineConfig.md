---
editUrl: false
next: false
prev: false
title: "PipelineConfig"
---

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L24)

파이프라인 실행기 구성 타입입니다.

## Properties

### filters

> **filters**: `ExceptionFilter`\<`unknown`, [`HttpExecutionContext`](/api/transports-http/src/classes/httpexecutioncontext/)\>[]

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:27](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L27)

***

### guards

> **guards**: [`Guard`](/api/framework-context/src/interfaces/guard/)\<`ExecutionContext`\>[]

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:25](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L25)

***

### interceptors

> **interceptors**: `Interceptor`\<`ExecutionContext`\>[]

Defined in: [packages/transports-http/src/libs/PipelineRunner.ts:26](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/PipelineRunner.ts#L26)

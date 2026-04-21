---
editUrl: false
next: false
prev: false
title: "RouteCompiler"
---

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:62](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/RouteCompiler.ts#L62)

REST 컨트롤러 메타데이터를 실행 가능한 라우트 정의로 컴파일합니다.

## Constructors

### Constructor

> **new RouteCompiler**(`logger`, `pipelineRunner`): `RouteCompiler`

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:65](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/RouteCompiler.ts#L65)

#### Parameters

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

##### pipelineRunner

[`PipelineRunner`](/api/transports-http/src/classes/pipelinerunner/)

#### Returns

`RouteCompiler`

## Methods

### compile()

> **compile**(`controllers`, `options?`): [`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:70](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/RouteCompiler.ts#L70)

#### Parameters

##### controllers

`Constructor`[]

##### options?

[`CompileOptions`](/api/transports-http/src/interfaces/compileoptions/) = `{}`

#### Returns

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

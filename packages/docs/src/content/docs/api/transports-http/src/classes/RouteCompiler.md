---
editUrl: false
next: false
prev: false
title: "RouteCompiler"
---

REST 컨트롤러 메타데이터를 실행 가능한 라우트 정의로 컴파일합니다.

## Constructors

### Constructor

> **new RouteCompiler**(`logger`, `pipelineRunner`): `RouteCompiler`

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

#### Parameters

##### controllers

`Constructor`[]

##### options?

[`CompileOptions`](/api/transports-http/src/interfaces/compileoptions/) = `{}`

#### Returns

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

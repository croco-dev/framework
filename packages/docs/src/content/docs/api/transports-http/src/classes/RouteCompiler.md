---
editUrl: false
next: false
prev: false
title: "RouteCompiler"
---

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:59](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/RouteCompiler.ts#L59)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new RouteCompiler**(`logger`, `pipelineRunner`): `RouteCompiler`

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:62](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/RouteCompiler.ts#L62)

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

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:67](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/RouteCompiler.ts#L67)

#### Parameters

##### controllers

`Constructor`[]

##### options?

[`CompileOptions`](/api/transports-http/src/interfaces/compileoptions/) = `{}`

#### Returns

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

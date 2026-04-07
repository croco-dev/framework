---
editUrl: false
next: false
prev: false
title: "RouteCompiler"
---

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:59](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/RouteCompiler.ts#L59)

## Constructors

### Constructor

> **new RouteCompiler**(`logger`, `pipelineRunner`): `RouteCompiler`

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/RouteCompiler.ts#L62)

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

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:67](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/RouteCompiler.ts#L67)

#### Parameters

##### controllers

`Constructor`[]

##### options?

[`CompileOptions`](/api/transports-http/src/interfaces/compileoptions/) = `{}`

#### Returns

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

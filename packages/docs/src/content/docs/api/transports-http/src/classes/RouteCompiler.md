---
editUrl: false
next: false
prev: false
title: "RouteCompiler"
---

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:61](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/RouteCompiler.ts#L61)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new RouteCompiler**(): `RouteCompiler`

#### Returns

`RouteCompiler`

## Methods

### compile()

> **compile**(`controllers`, `options?`): [`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:66](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/RouteCompiler.ts#L66)

#### Parameters

##### controllers

`Constructor`[]

##### options?

[`CompileOptions`](/api/transports-http/src/interfaces/compileoptions/) = `{}`

#### Returns

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

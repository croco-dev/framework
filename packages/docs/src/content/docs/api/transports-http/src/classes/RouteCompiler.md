---
editUrl: false
next: false
prev: false
title: "RouteCompiler"
---

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:47](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/RouteCompiler.ts#L47)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new RouteCompiler**(): `RouteCompiler`

#### Returns

`RouteCompiler`

## Methods

### compile()

> **compile**(`controllers`, `options?`): [`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

Defined in: [packages/transports-http/src/libs/RouteCompiler.ts:52](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/RouteCompiler.ts#L52)

#### Parameters

##### controllers

`Constructor`[]

##### options?

[`CompileOptions`](/api/transports-http/src/interfaces/compileoptions/) = `{}`

#### Returns

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)[]

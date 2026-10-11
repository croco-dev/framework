---
editUrl: false
next: false
prev: false
title: "CompiledRoute"
---

## Properties

### controllerInstance?

> `optional` **controllerInstance?**: `unknown`

---

### handler

> **handler**: (`ctx`) => `Promise`\<`unknown`\>

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Promise`\<`unknown`\>

---

### hasResponseBody?

> `optional` **hasResponseBody?**: `boolean`

Declared output-schema presence. True when the route declares a response
body contract (for example `@ResponseSchema`), so an explicit `null`
result stays a JSON body instead of collapsing into 204 no-content.
Omitted/falsy preserves the legacy schemaless empty-response behavior.

---

### method

> **method**: `string`

---

### methodName

> **methodName**: `string` \| `symbol`

---

### path

> **path**: `string`

---

### pipelineGraph?

> `optional` **pipelineGraph?**: [`RequestPipelineGraph`](/api/framework-context/src/type-aliases/requestpipelinegraph/)

---

### pipelineGraphConfig?

> `optional` **pipelineGraphConfig?**: [`CompiledRoutePipelineGraphConfig`](/api/transports-http/src/type-aliases/compiledroutepipelinegraphconfig/)

---

### successStatus?

> `optional` **successStatus?**: `number`

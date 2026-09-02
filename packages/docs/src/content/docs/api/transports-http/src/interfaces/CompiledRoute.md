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

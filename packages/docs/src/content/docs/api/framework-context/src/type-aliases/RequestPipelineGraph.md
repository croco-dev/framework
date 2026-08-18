---
editUrl: false
next: false
prev: false
title: "RequestPipelineGraph"
---

> **RequestPipelineGraph** = `object`

## Properties

### debugDump

> `readonly` **debugDump**: `string`

***

### edges

> `readonly` **edges**: readonly [`RequestPipelineGraphEdge`](/api/framework-context/src/type-aliases/requestpipelinegraphedge/)[]

***

### errorOrder

> `readonly` **errorOrder**: readonly `string`[]

***

### executionOrder

> `readonly` **executionOrder**: readonly `string`[]

***

### nodes

> `readonly` **nodes**: readonly [`ResolvedRequestPipelineNode`](/api/framework-context/src/type-aliases/resolvedrequestpipelinenode/)[]

***

### phaseOrder

> `readonly` **phaseOrder**: [`RequestPipelinePhaseOrder`](/api/framework-context/src/type-aliases/requestpipelinephaseorder/)

***

### successOrder

> `readonly` **successOrder**: readonly `string`[]

***

### target?

> `readonly` `optional` **target?**: `string`

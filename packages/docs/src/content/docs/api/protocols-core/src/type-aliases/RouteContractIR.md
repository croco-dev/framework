---
editUrl: false
next: false
prev: false
title: "RouteContractIR"
---

> **RouteContractIR** = `object`

## Properties

### id

> `readonly` **id**: `string` \| `null`

***

### inputSchemas

> `readonly` **inputSchemas**: `RouteInputSchemas`

***

### method

> `readonly` **method**: `string`

***

### operationId?

> `readonly` `optional` **operationId?**: `string`

***

### outputSchema

> `readonly` **outputSchema**: `z.ZodType` \| `null`

***

### path

> `readonly` **path**: `string`

***

### problemResponses

> `readonly` **problemResponses**: readonly [`ProblemResponseIR`](/api/protocols-core/src/type-aliases/problemresponseir/)[]

***

### problemResponsesDeclared

> `readonly` **problemResponsesDeclared**: `boolean`

***

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`RouteContractSourceLocation`](/api/protocols-core/src/type-aliases/routecontractsourcelocation/)

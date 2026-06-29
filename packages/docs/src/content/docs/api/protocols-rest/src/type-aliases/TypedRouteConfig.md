---
editUrl: false
next: false
prev: false
title: "TypedRouteConfig"
---

> **TypedRouteConfig**\<`Body`, `Query`, `Params`, `Response`\> = `object`

## Type Parameters

### Body

`Body` *extends* `z.ZodType` \| `undefined` = `undefined`

### Query

`Query` *extends* `z.ZodType` \| `undefined` = `undefined`

### Params

`Params` *extends* `z.ZodType` \| `undefined` = `undefined`

### Response

`Response` *extends* `z.ZodType` \| `undefined` = `undefined`

## Properties

### body?

> `optional` **body?**: `Body`

***

### inputSchemas?

> `optional` **inputSchemas?**: `RouteInputSchemas`

***

### method

> **method**: [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/)

***

### params?

> `optional` **params?**: `Params`

***

### path

> **path**: `string`

***

### query?

> `optional` **query?**: `Query`

***

### response?

> `optional` **response?**: `Response`

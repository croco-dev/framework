---
editUrl: false
next: false
prev: false
title: "ApiEndpoint"
---

> **ApiEndpoint**\<`Method`, `Path`, `Body`, `Query`, `Params`, `Response`\> = `object`

## Type Parameters

### Method

`Method` *extends* [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/) = [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/)

### Path

`Path` *extends* `string` = `string`

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

### method

> **method**: `Method`

***

### params?

> `optional` **params?**: `Params`

***

### path

> **path**: `Path`

***

### query?

> `optional` **query?**: `Query`

***

### response?

> `optional` **response?**: `Response`

---
editUrl: false
next: false
prev: false
title: "RouteContractSpec"
---

> **RouteContractSpec**\<`Method`, `Path`, `Params`, `Query`, `Body`, `Response`, `Problems`\> = `object`

## Type Parameters

### Method

`Method` *extends* [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/) = [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/)

### Path

`Path` *extends* `string` = `string`

### Params

`Params` *extends* `AnyZodObject` \| `undefined` = `AnyZodObject` \| `undefined`

### Query

`Query` *extends* `AnyZodObject` \| `undefined` = `AnyZodObject` \| `undefined`

### Body

`Body` *extends* `z.ZodType` \| `undefined` = `z.ZodType` \| `undefined`

### Response

`Response` *extends* `z.ZodType` \| `undefined` = `z.ZodType` \| `undefined`

### Problems

`Problems` *extends* readonly `RouteContractProblem`[] \| `undefined` = readonly `RouteContractProblem`[] \| `undefined`

## Properties

### body?

> `readonly` `optional` **body**: `Body`

***

### method

> `readonly` **method**: `Method`

***

### operationId?

> `readonly` `optional` **operationId**: `string`

***

### params?

> `readonly` `optional` **params**: `Params`

***

### path

> `readonly` **path**: `Path`

***

### problems?

> `readonly` `optional` **problems**: `Problems`

***

### query?

> `readonly` `optional` **query**: `Query`

***

### response?

> `readonly` `optional` **response**: `Response`

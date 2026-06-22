---
editUrl: false
next: false
prev: false
title: "ApiEndpoint"
---

> **ApiEndpoint**\<`Method`, `Path`, `Body`, `Query`, `Params`, `Response`\> = `object`

## Type Parameters

### Method

`Method` _extends_ [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/) = [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/)

### Path

`Path` _extends_ `string` = `string`

### Body

`Body` _extends_ `z.ZodType` \| `undefined` = `undefined`

### Query

`Query` _extends_ `z.ZodType` \| `undefined` = `undefined`

### Params

`Params` _extends_ `z.ZodType` \| `undefined` = `undefined`

### Response

`Response` _extends_ `z.ZodType` \| `undefined` = `undefined`

## Properties

### body?

> `optional` **body?**: `Body`

---

### method

> **method**: `Method`

---

### params?

> `optional` **params?**: `Params`

---

### path

> **path**: `Path`

---

### query?

> `optional` **query?**: `Query`

---

### response?

> `optional` **response?**: `Response`

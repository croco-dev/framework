---
editUrl: false
next: false
prev: false
title: "TypedRouteConfig"
---

> **TypedRouteConfig**\<`Body`, `Query`, `Params`, `Response`\> = `object`

## Type Parameters

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

### inputSchemas?

> `optional` **inputSchemas?**: `RouteInputSchemas`

---

### method

> **method**: [`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/)

---

### params?

> `optional` **params?**: `Params`

---

### path

> **path**: `string`

---

### query?

> `optional` **query?**: `Query`

---

### response?

> `optional` **response?**: `Response`

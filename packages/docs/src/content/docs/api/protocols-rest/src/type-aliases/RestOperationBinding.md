---
editUrl: false
next: false
prev: false
title: "RestOperationBinding"
---

> **RestOperationBinding**\<`Context`, `Kind`\> = `object`

## Type Parameters

### Context

`Context`

### Kind

`Kind` _extends_ `"query"` \| `"command"` = `"query"` \| `"command"`

## Properties

### createContext

> `readonly` **createContext**: (`request`) => `Context` \| `Promise`\<`Context`\>

#### Parameters

##### request

[`RestOperationRequest`](/api/protocols-rest/src/type-aliases/restoperationrequest/)

#### Returns

`Context` \| `Promise`\<`Context`\>

---

### input

> `readonly` **input**: `"body"` \| `"query"` \| `"params"`

---

### method

> `readonly` **method**: `Kind` _extends_ `"command"` ? `"POST"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"` : `"GET"` \| `"POST"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"`

---

### path

> `readonly` **path**: `string`

---

### successStatus?

> `readonly` `optional` **successStatus?**: `number`

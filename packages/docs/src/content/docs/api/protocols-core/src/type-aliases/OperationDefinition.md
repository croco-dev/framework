---
editUrl: false
next: false
prev: false
title: "OperationDefinition"
---

> **OperationDefinition**\<`Input`, `Output`, `Context`, `Kind`\> = `object`

Transport-independent, explicitly authorized business operation contract.

## Type Parameters

### Input

`Input` _extends_ `z.ZodType`

### Output

`Output` _extends_ `z.ZodType`

### Context

`Context`

### Kind

`Kind` _extends_ `"query"` \| `"command"` = `"query"` \| `"command"`

## Properties

### authorize

> `readonly` **authorize**: (`context`) => `void` \| `Promise`\<`void`\>

Runs before input is read or parsed. Throw a Problem to deny access.

#### Parameters

##### context

`Context`

#### Returns

`void` \| `Promise`\<`void`\>

---

### id

> `readonly` **id**: `string`

---

### input

> `readonly` **input**: `Input`

---

### kind

> `readonly` **kind**: `Kind`

---

### output

> `readonly` **output**: `Output`

---

### policy?

> `readonly` `optional` **policy?**: (`input`, `context`) => `void` \| `Promise`\<`void`\>

Runs on parsed domain input, after authorization and before the handler.

#### Parameters

##### input

`z.output`\<`Input`\>

##### context

`Context`

#### Returns

`void` \| `Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "Operation"
---

> **Operation**\<`Input`, `Output`, `Context`, `Kind`\> = `object`

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

### definition

> `readonly` **definition**: [`OperationDefinition`](/api/protocols-core/src/type-aliases/operationdefinition/)\<`Input`, `Output`, `Context`, `Kind`\>

---

### dispatch

> `readonly` **dispatch**: (`context`, `readInput`) => `Promise`\<`z.output`\<`Output`\>\>

Adapter boundary: authorization completes before the untrusted input source is read.

#### Parameters

##### context

`Context`

##### readInput

() => `unknown` \| `Promise`\<`unknown`\>

#### Returns

`Promise`\<`z.output`\<`Output`\>\>

---

### invoke

> `readonly` **invoke**: (`input`, `context`) => `Promise`\<`z.output`\<`Output`\>\>

The caller supplies server-verified authority separately from domain input.

#### Parameters

##### input

`z.input`\<`Input`\>

##### context

`Context`

#### Returns

`Promise`\<`z.output`\<`Output`\>\>

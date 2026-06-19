---
editUrl: false
next: false
prev: false
title: "OpenAiResponseRequest"
---

> **OpenAiResponseRequest** = `object`

## Properties

### input

> `readonly` **input**: `string` \| readonly [`OpenAiInputMessage`](/api/llm-openai/src/type-aliases/openaiinputmessage/)[]

***

### instructions?

> `readonly` `optional` **instructions**: `string`

***

### max\_output\_tokens?

> `readonly` `optional` **max\_output\_tokens**: `number`

***

### model

> `readonly` **model**: `string`

***

### stop?

> `readonly` `optional` **stop**: readonly `string`[]

***

### store?

> `readonly` `optional` **store**: `boolean`

***

### stream?

> `readonly` `optional` **stream**: `boolean`

***

### temperature?

> `readonly` `optional` **temperature**: `number`

***

### text?

> `readonly` `optional` **text**: `object`

#### format

> `readonly` **format**: `OpenAiTextFormat`

***

### tool\_choice?

> `readonly` `optional` **tool\_choice**: `"auto"`

***

### tools?

> `readonly` `optional` **tools**: readonly `OpenAiFunctionTool`[]

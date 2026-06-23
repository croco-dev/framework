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

---

### instructions?

> `readonly` `optional` **instructions?**: `string`

---

### max_output_tokens?

> `readonly` `optional` **max_output_tokens?**: `number`

---

### model

> `readonly` **model**: `string`

---

### stop?

> `readonly` `optional` **stop?**: readonly `string`[]

---

### store?

> `readonly` `optional` **store?**: `boolean`

---

### stream?

> `readonly` `optional` **stream?**: `boolean`

---

### temperature?

> `readonly` `optional` **temperature?**: `number`

---

### text?

> `readonly` `optional` **text?**: `object`

#### format

> `readonly` **format**: `OpenAiTextFormat`

---

### tool_choice?

> `readonly` `optional` **tool_choice?**: `"auto"`

---

### tools?

> `readonly` `optional` **tools?**: readonly `OpenAiFunctionTool`[]

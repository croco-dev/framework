---
editUrl: false
next: false
prev: false
title: "LlmProviderConformancePromptSet"
---

> **LlmProviderConformancePromptSet**\<`TObject`\> = `object`

## Type Parameters

### TObject

`TObject` = `unknown`

## Properties

### embed

> `readonly` **embed**: `object`

#### expectedDimensions?

> `readonly` `optional` **expectedDimensions?**: `number`

#### text

> `readonly` **text**: `string`

***

### embedMany

> `readonly` **embedMany**: `object`

#### expectedDimensions?

> `readonly` `optional` **expectedDimensions?**: `number`

#### texts

> `readonly` **texts**: readonly `string`[]

***

### generate

> `readonly` **generate**: `object`

#### expectedText?

> `readonly` `optional` **expectedText?**: `string` \| `RegExp`

#### prompt

> `readonly` **prompt**: `string`

***

### object

> `readonly` **object**: `object`

#### assertObject?

> `readonly` `optional` **assertObject?**: (`value`) => `void`

##### Parameters

###### value

`TObject`

##### Returns

`void`

#### prompt

> `readonly` **prompt**: `string`

#### schema

> `readonly` **schema**: [`GenerateObjectParams`](/api/llm-core/src/type-aliases/generateobjectparams/)\<`TObject`\>\[`"schema"`\]

***

### stream

> `readonly` **stream**: `object`

#### minimumChunks?

> `readonly` `optional` **minimumChunks?**: `number`

#### prompt

> `readonly` **prompt**: `string`

***

### tool

> `readonly` **tool**: `object`

#### assertToolResult?

> `readonly` `optional` **assertToolResult?**: (`result`) => `void`

##### Parameters

###### result

[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)

##### Returns

`void`

#### prompt

> `readonly` **prompt**: `string`

#### tools

> `readonly` **tools**: readonly [`ToolDefinition`](/api/llm-core/src/type-aliases/tooldefinition/)[]

---
editUrl: false
next: false
prev: false
title: "LlmProviderConformanceOptions"
---

> **LlmProviderConformanceOptions**\<`TObject`\> = `object`

## Type Parameters

### TObject

`TObject` = `unknown`

## Properties

### createFailingModel()?

> `readonly` `optional` **createFailingModel**: () => [`LlmModel`](/api/llm-core/src/classes/llmmodel/) \| `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

#### Returns

[`LlmModel`](/api/llm-core/src/classes/llmmodel/) \| `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

***

### createModel()

> `readonly` **createModel**: () => [`LlmModel`](/api/llm-core/src/classes/llmmodel/) \| `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

#### Returns

[`LlmModel`](/api/llm-core/src/classes/llmmodel/) \| `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

***

### modelId

> `readonly` **modelId**: `string`

***

### prompts

> `readonly` **prompts**: [`LlmProviderConformancePromptSet`](/api/testing/src/type-aliases/llmproviderconformancepromptset/)\<`TObject`\>

***

### providerName

> `readonly` **providerName**: `string`

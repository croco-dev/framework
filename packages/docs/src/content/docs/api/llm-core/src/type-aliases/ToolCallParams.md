---
editUrl: false
next: false
prev: false
title: "ToolCallParams"
---

> **ToolCallParams** = [`CancellableRequestOptions`](/api/llm-core/src/type-aliases/cancellablerequestoptions/) & `object`

툴 호출 파라미터

## Type Declaration

### modelId?

> `optional` **modelId?**: `string`

모델 ID

### prompt

> **prompt**: `string`

사용자 프롬프트

### systemPrompt?

> `optional` **systemPrompt?**: `string`

시스템 프롬프트

### tools

> **tools**: [`ToolDefinition`](/api/llm-core/src/type-aliases/tooldefinition/)[]

사용 가능한 툴 목록

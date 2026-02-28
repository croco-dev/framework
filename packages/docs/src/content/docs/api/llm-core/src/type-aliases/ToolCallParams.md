---
editUrl: false
next: false
prev: false
title: "ToolCallParams"
---

> **ToolCallParams** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:121](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/types.ts#L121)

툴 호출 파라미터

## Properties

### modelId?

> `optional` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:125](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/types.ts#L125)

모델 ID

***

### prompt

> **prompt**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:135](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/types.ts#L135)

사용자 프롬프트

***

### systemPrompt?

> `optional` **systemPrompt**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:140](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/types.ts#L140)

시스템 프롬프트

***

### tools

> **tools**: [`ToolDefinition`](/api/llm-core/src/type-aliases/tooldefinition/)[]

Defined in: [packages/llm-core/src/libs/types.ts:130](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/types.ts#L130)

사용 가능한 툴 목록

---
editUrl: false
next: false
prev: false
title: "GenerateParams"
---

> **GenerateParams** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:4](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L4)

텍스트 생성 파라미터

## Properties

### maxTokens?

> `optional` **maxTokens**: `number`

Defined in: [packages/llm-core/src/libs/types.ts:28](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L28)

최대 생성 토큰 수

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [packages/llm-core/src/libs/types.ts:38](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L38)

메타데이터

***

### modelId?

> `optional` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:8](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L8)

모델 ID

***

### prompt

> **prompt**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:13](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L13)

사용자 프롬프트

***

### stopSequences?

> `optional` **stopSequences**: `string`[]

Defined in: [packages/llm-core/src/libs/types.ts:33](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L33)

정지 시퀀스 목록

***

### systemPrompt?

> `optional` **systemPrompt**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:18](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L18)

시스템 프롬프트

***

### temperature?

> `optional` **temperature**: `number`

Defined in: [packages/llm-core/src/libs/types.ts:23](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/types.ts#L23)

샘플링 온도 (0-2)

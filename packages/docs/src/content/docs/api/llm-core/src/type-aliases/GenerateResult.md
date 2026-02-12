---
editUrl: false
next: false
prev: false
title: "GenerateResult"
---

> **GenerateResult** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:44](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/types.ts#L44)

텍스트 생성 결과

## Properties

### metadata?

> `optional` **metadata**: [`LlmMetadata`](/api/llm-core/src/type-aliases/llmmetadata/)

Defined in: [packages/llm-core/src/libs/types.ts:58](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/types.ts#L58)

메타데이터

***

### text

> **text**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:48](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/types.ts#L48)

생성된 텍스트

***

### usage

> **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/types.ts:53](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/types.ts#L53)

토큰 사용량

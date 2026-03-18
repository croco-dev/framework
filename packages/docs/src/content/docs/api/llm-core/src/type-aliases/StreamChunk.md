---
editUrl: false
next: false
prev: false
title: "StreamChunk"
---

> **StreamChunk** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:71](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/types.ts#L71)

스트리밍 청크

## Properties

### delta

> **delta**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:75](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/types.ts#L75)

증분 텍스트

***

### usage?

> `optional` **usage**: `Partial`\<[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)\>

Defined in: [packages/llm-core/src/libs/types.ts:80](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/types.ts#L80)

토큰 사용량 (선택적, 마지막 청크에 포함)

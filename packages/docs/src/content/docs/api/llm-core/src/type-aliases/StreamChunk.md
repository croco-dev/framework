---
editUrl: false
next: false
prev: false
title: "StreamChunk"
---

> **StreamChunk** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:71](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/llm-core/src/libs/types.ts#L71)

스트리밍 청크

## Properties

### delta

> **delta**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:75](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/llm-core/src/libs/types.ts#L75)

증분 텍스트

***

### usage?

> `optional` **usage**: `Partial`\<[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)\>

Defined in: [packages/llm-core/src/libs/types.ts:80](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/llm-core/src/libs/types.ts#L80)

토큰 사용량 (선택적, 마지막 청크에 포함)

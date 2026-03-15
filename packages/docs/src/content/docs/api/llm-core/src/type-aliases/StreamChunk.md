---
editUrl: false
next: false
prev: false
title: "StreamChunk"
---

> **StreamChunk** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:71](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/types.ts#L71)

스트리밍 청크

## Properties

### delta

> **delta**: `string`

Defined in: [packages/llm-core/src/libs/types.ts:75](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/types.ts#L75)

증분 텍스트

***

### usage?

> `optional` **usage**: `Partial`\<[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)\>

Defined in: [packages/llm-core/src/libs/types.ts:80](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/types.ts#L80)

토큰 사용량 (선택적, 마지막 청크에 포함)

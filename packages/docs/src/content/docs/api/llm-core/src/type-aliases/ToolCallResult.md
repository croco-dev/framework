---
editUrl: false
next: false
prev: false
title: "ToolCallResult"
---

> **ToolCallResult** = `object`

Defined in: [packages/llm-core/src/libs/types.ts:146](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/types.ts#L146)

툴 호출 결과

## Properties

### toolCalls

> **toolCalls**: `object`[]

Defined in: [packages/llm-core/src/libs/types.ts:150](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/types.ts#L150)

툴 호출 목록

#### arguments

> **arguments**: `Record`\<`string`, `unknown`\>

#### name

> **name**: `string`

***

### usage

> **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/types.ts:158](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/types.ts#L158)

토큰 사용량

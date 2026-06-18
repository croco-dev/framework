---
editUrl: false
next: false
prev: false
title: "LlmQuotaPolicy"
---

LLM 사용량 기록 전 quota를 검사하는 정책 인터페이스입니다.

## Methods

### enforce()

> **enforce**(`context`): `Promise`\<`void`\>

전달된 사용량 컨텍스트가 quota를 초과하면 Problem을 던집니다.

#### Parameters

##### context

[`LlmQuotaPolicyContext`](/api/llm-metering/src/type-aliases/llmquotapolicycontext/)

#### Returns

`Promise`\<`void`\>

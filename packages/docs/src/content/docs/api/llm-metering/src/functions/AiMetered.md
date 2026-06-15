---
editUrl: false
next: false
prev: false
title: "AiMetered"
---

> **AiMetered**(`options?`): `MethodDecorator`

## Parameters

### options?

[`AiMeteredOptions`](/api/llm-metering/src/type-aliases/aimeteredoptions/) = `{}`

## Returns

`MethodDecorator`

## Ai Metered

메서드 데코레이터

## Description

메서드 호출 시 자동으로 LLM 사용량을 기록합니다.
LlmService의 generate/stream/embed 메서드에서 사용됩니다.

## Example

```typescript
class MyService {
  @AiMetered()
  async generateText(prompt: string): Promise<string> {
    // LlmService.generate() 호출
    return await llmService.generate({ prompt });
  }

  @AiMetered({
    idempotencyKeyExtractor: (args) => args[0]?.id,
  })
  async embedWithKey(text: string, id: string): Promise<number[]> {
    // ...
  }
}
```

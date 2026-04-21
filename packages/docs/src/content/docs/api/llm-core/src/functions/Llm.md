---
editUrl: false
next: false
prev: false
title: "Llm"
---

> **Llm**(`options?`): `MethodDecorator`

Defined in: [packages/llm-core/src/libs/decorators/Llm.ts:58](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/decorators/Llm.ts#L58)

## Parameters

### options?

[`LlmOptions`](/api/llm-core/src/type-aliases/llmoptions/) = `{}`

## Returns

`MethodDecorator`

## Llm

메서드 데코레이터

## Description

메서드 호출 시 자동으로 LLM 텍스트 생성을 수행합니다.
메서드 실행 전에 LlmService.generate()를 호출하고 결과를 반환합니다.

## Example

```typescript
class ChatService {
  @Llm({ modelId: 'gpt-4' })
  async generateResponse(prompt: string): Promise<string> {
    // 데코레이터가 LlmService를 호출하여 결과 반환
  }

  @Llm({ modelId: 'gpt-3.5-turbo', systemPrompt: 'You are helpful.' })
  async chat(userPrompt: string): Promise<string> {
    // systemPrompt와 함께 호출
  }
}
```

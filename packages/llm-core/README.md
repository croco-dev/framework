# @croco/llm-core

LLM 생성, 스트리밍, 도구 호출, 임베딩을 추상화하는 Croco LLM 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/llm-core
```

## 사용법

```ts
import { InMemoryLlmRegistry, LlmService } from "@croco/llm-core";

const registry = new InMemoryLlmRegistry([defaultModel]);
const llmService = new LlmService(registry, eventBus);

const result = await llmService.generate({
  modelId: "default",
  prompt: "구독 이탈 고객을 줄이는 아이디어를 3개 제안해줘.",
});
```

```ts
import { Llm, setLlmService } from "@croco/llm-core";

setLlmService(llmService);

class AssistantService {
  @Llm({ modelId: "default", systemPrompt: "항상 한국어로 답변해." })
  async summarize(prompt: string): Promise<string> {
    return prompt;
  }
}
```

## API 레퍼런스

### 핵심 클래스

- `LlmService`, 생성, 스트리밍, 임베딩, 도구 호출을 통합 제공합니다.
- `LlmModel`, 공급자 구현이 따라야 하는 추상 모델 계약입니다.
- `LlmRegistry`, 모델 등록과 조회를 담당하는 추상 레지스트리입니다.
- `InMemoryLlmModel`, 테스트용 메모리 모델 구현체입니다.
- `InMemoryLlmRegistry`, 테스트용 레지스트리 구현체입니다.

### 데코레이터와 헬퍼

- `@Llm`, 메서드 호출을 LLM 생성으로 연결합니다.
- `setLlmService`, `getLlmService`, 데코레이터용 전역 서비스를 관리합니다.
- `getLlmMetadata`, 메서드에 등록된 LLM 메타데이터를 조회합니다.

### 주요 타입

- `GenerateParams`, `GenerateResult`, `StreamParams`, `StreamChunk`
- `EmbedParams`, `EmbedResult`, `EmbedManyParams`, `EmbedManyResult`
- `GenerateObjectParams`, `ToolCallParams`, `ToolCallResult`, `ToolDefinition`
- `LlmMetadata`, `LlmUsage`, `LlmCapabilities`, `LlmModelConfig`

### 이벤트와 문제 타입

- 이벤트: `LlmGeneratedEvent`, `LlmStreamCompletedEvent`, `LlmToolCalledEvent`, `LlmUsageRecordedEvent`
- 문제 타입: `LlmProviderNotFoundProblem`, `LlmTokenLimitExceededProblem`, `LlmRateLimitProblem`, `LlmServiceProblem`, `LlmToolExecutionProblem`

## 구현 포인트

- OpenAI, Anthropic 같은 공급자 구현은 `LlmModel`을 상속해 연결합니다.
- 이벤트 버스를 연결하면 생성 완료와 사용량 기록을 다른 패키지로 전달할 수 있습니다.
- LLM 호출 비용 추적은 `@croco/llm-metering` 패키지와 함께 사용합니다.

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

완료 이벤트 발행이 실패하면 모델 실행을 다시 호출하지 말고, 완료 결과와 안정적인 이벤트 intent를
`LlmCompletionEventPublicationProblem`에서 복구한 뒤 이벤트만 재시도합니다.

```ts
import { LlmCompletionEventPublicationProblem } from "@croco/llm-core";

try {
  await llmService.generate({ modelId: "default", prompt });
} catch (problem) {
  if (!(problem instanceof LlmCompletionEventPublicationProblem)) {
    throw problem;
  }

  const completedResult =
    problem.completion.operation === "generate" ? problem.completion.result : undefined;

  await llmService.retryCompletionEvent(problem);
}
```

영속 복구가 필요하면 `LlmService`의 세 번째 인자에 `completionEventIntentStore`를 제공합니다.
저장소의 `recordPending()`은 같은 intent에 대해 멱등이어야 합니다. `claimDelivery()`는 원자적으로 하나의
활성 claim만 발급하고, 실패한 발행의 claim은 `releaseDelivery()`로 해제하며, `markPublished()`는 이벤트
발행이 확인된 뒤 호출됩니다. 분산 저장소는 만료 가능한 lease와 fencing token을 검증해야 합니다.

```ts
const llmService = new LlmService(registry, eventBus, { completionEventIntentStore });
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
- `LlmCompletion`, `LlmCompletionEventIntent`, `LlmCompletionEventIntentStore`, `LlmServiceOptions`

### 이벤트와 문제 타입

- 이벤트: `LlmGeneratedEvent`, `LlmStreamCompletedEvent`, `LlmToolCalledEvent`, `LlmUsageRecordedEvent`
- 문제 타입: `LlmProviderNotFoundProblem`, `LlmTokenLimitExceededProblem`, `LlmRateLimitProblem`, `LlmCompletionEventPublicationProblem`, `LlmServiceProblem`, `LlmToolExecutionProblem`

## 구현 포인트

- OpenAI, Anthropic 같은 공급자 구현은 `LlmModel`을 상속해 연결합니다.
- 신규 공급자 패키지는 `@croco/testing`의 `createLlmProviderConformanceSuite`를 통과해야 합니다.
- OpenAI는 첫 실공급자 패키지 대상이지만, Responses API/도구 호출/임베딩/스트리밍 normalization을 별도 패키지에서 검증한 뒤 추가합니다. 결정 근거는 [docs/llm-governance.md](../../docs/llm-governance.md)를 참고하세요.
- 이벤트 버스를 연결하면 생성 완료와 사용량 기록을 다른 패키지로 전달할 수 있습니다.
- 완료 이벤트 발행 실패는 `retryable: false`인 별도 Problem이며, `retryCompletionEvent()`는 모델 공급자를 다시 호출하지 않고 저장된 intent의 미완료 단계만 복구합니다.
- 스트림 소비자가 조기 종료하거나 `StreamParams.signal`이 abort되면 upstream 모델 스트림에도 abort signal이 전달되며, 취소된 스트림은 `LlmStreamCompletedEvent`를 발행하지 않습니다.
- 완료된 스트림의 `LlmStreamCompletedEvent.text`는 이벤트 payload 메모리 사용을 제한하기 위해 긴 응답에서 잘릴 수 있으며, 이 경우 `textTruncated`가 `true`로 설정됩니다. 사용량 계산은 전체 스트림 길이를 기준으로 유지됩니다.
- LLM 호출 비용 추적은 `@croco/llm-metering` 패키지와 함께 사용합니다.

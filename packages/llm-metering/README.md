# @croco/llm-metering

LLM 토큰 사용량과 비용을 기록하고 quota를 강제하는 LLM 미터링 패키지입니다.

## 설치

```bash
pnpm add @croco/llm-metering
```

## 사용법

```ts
import { LlmMeteringService } from "@croco/llm-metering";

const metering = new LlmMeteringService({
  meteringService,
  eventBus,
  pricingTable,
  quotaPolicy,
});

await metering.recordUsage({
  tenantId: "tenant-123",
  modelId: "gpt-4o-mini",
  provider: "openai",
  usage: {
    promptTokens: 120,
    completionTokens: 80,
    totalTokens: 200,
    accuracy: "EXACT",
  },
  idempotencyKey: "req-1",
});
```

```ts
import { AiMetered, setLlmMeteringService } from "@croco/llm-metering";

setLlmMeteringService(metering);

class LlmFacade {
  @AiMetered()
  async generate(): Promise<unknown> {
    return llmService.generate({ modelId: "default", prompt: "안녕" });
  }
}
```

## API 레퍼런스

### 핵심 클래스

- `LlmMeteringService`, 토큰 사용량 기록, 비용 계산, quota 확인을 담당합니다.
- `PricingTable`, 공급자와 모델별 가격표를 조회하고 비용을 계산합니다.

### 데코레이터와 유틸리티

- `@AiMetered`, 메서드 결과에서 사용량을 추출해 자동 기록합니다.
- `setLlmMeteringService`, `getLlmMeteringService`, 데코레이터용 전역 서비스를 관리합니다.
- `createMeteredAsyncIterable`, 스트리밍 완료 시 사용량을 기록합니다.
- `extractUsageFromChunk`, 청크에서 usage와 모델 정보를 추출합니다.

### 주요 타입

- `LlmUsageEvent`, `LlmCostRecord`, `LlmMeteringServiceOptions`
- `LlmUsageRecord`, `LlmEmbeddingUsageRecord`, `LlmCostBudget`, `ModelPricing`

### 이벤트와 문제 타입

- 이벤트: `LlmUsageRecordedEvent`, `LlmCostBudgetExceededEvent`
- 문제 타입: `LlmMeteringRecordFailedProblem`, `LlmQuotaExceededProblem`, `LlmCostLimitExceededProblem`, `PricingNotFoundProblem`

## 구현 포인트

- 내부적으로 `@croco/metering-core`에 `llm.prompt_tokens`, `llm.completion_tokens`, `llm.cost_usd` 같은 meter를 기록합니다.
- 스트리밍 응답과 임베딩 결과 모두 같은 서비스에서 다룰 수 있습니다.
- `PricingTable.fromRegistry()`로 version/source/effectiveDate가 있는 가격 registry를 주입합니다. 기본 `samplePricingRegistry`는 테스트와 데모용 sample data이며 현재 공급자 가격으로 간주하지 않습니다.
- `quotaPolicy`는 기록 전 projected usage를 검사합니다. `metering-core` meter quota도 함께 등록하면 기록 중 quota도 fail-closed로 유지됩니다.
- 미터링 실패 정책은 명시적 fail-closed입니다. 현재 지원되는 정책은 `failurePolicy: "fail-closed"`이며, quota policy 또는 meter write가 실패하면 `LlmMeteringRecordFailedProblem`/`LlmQuotaExceededProblem`으로 실패 meter와 quota 정보를 보존합니다.
- `LlmTelemetryBridge`는 `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`, `gen_ai.usage.cost_usd`, `gen_ai.client.user`, `gen_ai.usage.accuracy` 속성과 `llm.usage` 이벤트를 기록합니다.
- 전체 provider/pricing/quota/telemetry 가이드는 [docs/llm-governance.md](../../docs/llm-governance.md)를 참고하세요.

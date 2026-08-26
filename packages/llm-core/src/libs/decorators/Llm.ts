import { AsyncLocalStorage } from "node:async_hooks";
import "reflect-metadata";
import type { LlmService } from "../LlmService";
import { InvalidLlmPromptProblem, LlmServiceNotInitializedProblem } from "../problems/LlmProblems";
import type { GenerateParams, GenerateResult, LlmMetadata } from "../types";

export const LLM_METADATA_KEY = Symbol("llm:llm");

export type LlmOptions = {
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
};

/** Per-call options accepted as the decorated method's second argument. */
export type LlmInvocationOptions = {
  signal?: AbortSignal;
};

export type LlmMethodMetadata = LlmMetadata;

let llmServiceInstance: LlmService | null = null;
const llmServiceScope = new AsyncLocalStorage<LlmService>();

/**
 * 프로세스 기본 LlmService 인스턴스 설정 (앱 부트스트랩에서 호출)
 *
 * 요청 또는 실행별 서비스는 전역 기본값을 변경하지 않고 `runWithLlmService`로 설정해야 합니다.
 */
export function setLlmService(service: LlmService): void {
  llmServiceInstance = service;
}

/** 프로세스 기본 LlmService 인스턴스를 제거합니다. */
export function clearLlmService(): void {
  llmServiceInstance = null;
}

/** 주어진 콜백과 그 비동기 하위 작업에서 사용할 LlmService를 설정합니다. */
export function runWithLlmService<T>(service: LlmService, fn: () => T): T {
  return llmServiceScope.run(service, fn);
}

/**
 * 현재 실행 scope의 LlmService를 조회하고, scope가 없으면 프로세스 기본값을 반환합니다.
 */
export function getLlmService(): LlmService | null {
  return llmServiceScope.getStore() ?? llmServiceInstance;
}

/**
 * @Llm 메서드 데코레이터
 *
 * @description
 * 메서드 호출 시 자동으로 LLM 텍스트 생성을 수행합니다.
 * 메서드 실행 전에 LlmService.generate()를 호출하고 결과를 반환합니다.
 *
 * @example
 * ```typescript
 * class ChatService {
 *   @Llm({ modelId: 'gpt-4' })
 *   async generateResponse(prompt: string, options?: LlmInvocationOptions): Promise<string> {
 *     // 데코레이터가 LlmService를 호출하여 결과 반환
 *   }
 *
 *   @Llm({ modelId: 'gpt-3.5-turbo', systemPrompt: 'You are helpful.' })
 *   async chat(userPrompt: string): Promise<string> {
 *     // systemPrompt와 함께 호출
 *   }
 * }
 * ```
 */
export function Llm(options: LlmOptions = {}): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const metadata: LlmMethodMetadata = {
      modelId: options.modelId ?? "default",
    };

    // 메타데이터 저장 (선택적 조회용)
    Reflect.defineMetadata(LLM_METADATA_KEY, metadata, _target, propertyKey);

    descriptor.value = async (...args: unknown[]): Promise<string> => {
      const service = getLlmService();
      if (!service) {
        throw new LlmServiceNotInitializedProblem();
      }

      const prompt = args[0];
      if (typeof prompt !== "string") {
        throw new InvalidLlmPromptProblem(prompt === undefined ? "undefined" : typeof prompt);
      }
      const invocationOptions = args[1] as LlmInvocationOptions | undefined;

      // GenerateParams 구성
      const params: GenerateParams = {
        modelId: metadata.modelId,
        prompt,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stopSequences: options.stopSequences,
        metadata: options.metadata,
        signal: invocationOptions?.signal,
      };

      const result: GenerateResult = await service.generate(params);

      return result.text;
    };

    return descriptor;
  };
}

/**
 * 메서드에서 Llm 메타데이터 조회
 */
export function getLlmMetadata(
  target: object,
  propertyKey: string | symbol,
): LlmMethodMetadata | undefined {
  return Reflect.getMetadata(LLM_METADATA_KEY, target, propertyKey);
}

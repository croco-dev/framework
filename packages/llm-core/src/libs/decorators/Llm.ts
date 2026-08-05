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

// LlmService 인스턴스를 저장할 전역 변수 (DI 컨테이너에서 설정)
let llmServiceInstance: LlmService | null = null;

/**
 * LlmService 인스턴스 설정 (앱 부트스트랩에서 호출)
 */
export function setLlmService(service: LlmService): void {
  llmServiceInstance = service;
}

/**
 * LlmService 인스턴스 조회
 */
export function getLlmService(): LlmService | null {
  return llmServiceInstance;
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

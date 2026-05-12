import { Token } from "@croco/framework-context";
import type { LlmModel } from "./LlmModel";

/**
 * LLM 레지스트리 추상 클래스
 *
 * @description
 * LLM 모델의 등록, 조회를 위한 추상화 계층입니다.
 * Token 기반 DI를 지원하며, 다중 제공자 관리를 지원합니다.
 */
export abstract class LlmRegistry {
  static readonly token = new Token<LlmRegistry>("LlmRegistry");

  /**
   * 모델 조회
   *
   * @param modelId - 모델 식별자
   * @returns LLM 모델 인스턴스
   */
  abstract getModel(modelId: string): Promise<LlmModel>;

  /**
   * 사용 가능한 모델 목록 조회
   *
   * @returns 모델 ID 목록
   */
  abstract listModels(): Promise<string[]>;

  /**
   * 제공자 등록
   *
   * @param providerId - 제공자 식별자
   * @param factory - 모델 생성 팩토리 함수
   */
  abstract registerProvider(providerId: string, factory: () => LlmModel): void;
}

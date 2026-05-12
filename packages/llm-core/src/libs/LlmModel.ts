import { Token } from "@croco/framework-context";
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmCapabilities,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
} from "./types";

/**
 * LLM 모델 추상 클래스
 *
 * @description
 * 특정 LLM 제공자(OpenAI, Anthropic 등)의 구현을 위한 추상화 계층입니다.
 * Token 기반 DI를 지원하며, 모든 구현체는 이 abstract class를 상속받아야 합니다.
 */
export abstract class LlmModel {
  static readonly token = new Token<LlmModel>("LlmModel");

  /**
   * 모델 식별자
   */
  abstract readonly modelId: string;

  /**
   * LLM 기능 플래그
   */
  abstract readonly capabilities: LlmCapabilities;

  /**
   * 텍스트 생성
   *
   * @param params - 생성 파라미터
   * @returns 생성 결과
   */
  abstract generate(params: GenerateParams): Promise<GenerateResult>;

  /**
   * 스트리밍 텍스트 생성
   *
   * @param params - 스트리밍 파라미터
   * @returns 스트리밍 청크 반복자
   */
  abstract stream(params: StreamParams): AsyncIterable<StreamChunk>;

  /**
   * 객체 생성
   *
   * @param params - 객체 생성 파라미터
   * @returns 생성된 객체
   */
  abstract generateObject<T>(params: GenerateObjectParams<T>): Promise<T>;

  /**
   * 툴 호출
   *
   * @param params - 툴 호출 파라미터
   * @returns 툴 호출 결과
   */
  abstract callTool(params: ToolCallParams): Promise<ToolCallResult>;

  /**
   * 임베딩 생성 (단일 텍스트)
   *
   * @param params - 임베딩 파라미터
   * @returns 임베딩 결과
   */
  abstract embed(params: EmbedParams): Promise<EmbedResult>;

  /**
   * 임베딩 생성 (배치)
   *
   * @param params - 배치 임베딩 파라미터
   * @returns 배치 임베딩 결과
   */
  abstract embedMany(params: EmbedManyParams): Promise<EmbedManyResult>;
}

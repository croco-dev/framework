/**
 * 텍스트 생성 파라미터
 */
export type GenerateParams = {
  /**
   * 모델 ID
   */
  modelId?: string;

  /**
   * 사용자 프롬프트
   */
  prompt: string;

  /**
   * 시스템 프롬프트
   */
  systemPrompt?: string;

  /**
   * 샘플링 온도 (0-2)
   */
  temperature?: number;

  /**
   * 최대 생성 토큰 수
   */
  maxTokens?: number;

  /**
   * 정지 시퀀스 목록
   */
  stopSequences?: string[];

  /**
   * 메타데이터
   */
  metadata?: Record<string, unknown>;
};

/**
 * 텍스트 생성 결과
 */
export type GenerateResult = {
  /**
   * 생성된 텍스트
   */
  text: string;

  /**
   * 토큰 사용량
   */
  usage: LlmUsage;

  /**
   * 메타데이터
   */
  metadata?: LlmMetadata;
};

/**
 * 스트리밍 파라미터
 */
export type StreamParams = Omit<GenerateParams, 'modelId'> & {
  modelId?: string;
};

/**
 * 스트리밍 청크
 */
export type StreamChunk = {
  /**
   * 증분 텍스트
   */
  delta: string;

  /**
   * 토큰 사용량 (선택적, 마지막 청크에 포함)
   */
  usage?: Partial<LlmUsage>;
};

/**
 * 객체 생성 파라미터
 */
export type GenerateObjectParams<T> = GenerateParams & {
  /**
   * 스키마
   */
  schema: T;

  /**
   * 생성 모드
   */
  mode?: 'json' | 'tool';
};

/**
 * 툴 정의
 */
export type ToolDefinition = {
  /**
   * 툴 이름
   */
  name: string;

  /**
   * 툴 설명
   */
  description: string;

  /**
   * 파라미터 스키마
   */
  parameters: Record<string, unknown>;
};

/**
 * 툴 호출 파라미터
 */
export type ToolCallParams = {
  /**
   * 모델 ID
   */
  modelId?: string;

  /**
   * 사용 가능한 툴 목록
   */
  tools: ToolDefinition[];

  /**
   * 사용자 프롬프트
   */
  prompt: string;

  /**
   * 시스템 프롬프트
   */
  systemPrompt?: string;
};

/**
 * 툴 호출 결과
 */
export type ToolCallResult = {
  /**
   * 툴 호출 목록
   */
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;

  /**
   * 토큰 사용량
   */
  usage: LlmUsage;
};

/**
 * 임베딩 파라미터
 */
export type EmbedParams = {
  /**
   * 임베딩할 텍스트
   */
  text: string;

  /**
   * 모델 ID (선택)
   */
  modelId?: string;
};

/**
 * 임베딩 결과
 */
export type EmbedResult = {
  /**
   * 임베딩 벡터
   */
  embedding: number[];

  /**
   * 토큰 사용량
   */
  usage: LlmUsage;
};

/**
 * 배치 임베딩 파라미터
 */
export type EmbedManyParams = {
  /**
   * 임베딩할 텍스트 목록
   */
  texts: string[];

  /**
   * 모델 ID (선택)
   */
  modelId?: string;
};

/**
 * 배치 임베딩 결과
 */
export type EmbedManyResult = {
  /**
   * 임베딩 벡터 목록
   */
  embeddings: number[][];

  /**
   * 토큰 사용량
   */
  usage: LlmUsage;
};

/**
 * 토큰 사용량
 */
export type LlmUsage = {
  /**
   * 입력 토큰 수
   */
  promptTokens: number;

  /**
   * 출력 토큰 수
   */
  completionTokens: number;

  /**
   * 총 토큰 수
   */
  totalTokens: number;

  /**
   * 정확도
   */
  accuracy?: UsageAccuracy;
};

/**
 * 메타데이터
 */
export type LlmMetadata = {
  /**
   * 모델 ID
   */
  modelId: string;

  /**
   * 완료 이유
   */
  finishReason?: string;

  /**
   * 추가 메타데이터
   */
  [key: string]: unknown;
};

/**
 * 토큰 사용량 정확도
 */
export type UsageAccuracy = 'EXACT' | 'ESTIMATED' | 'UNKNOWN';

/**
 * LLM 모델 설정
 */
export type LlmModelConfig = {
  /**
   * 모델 ID
   */
  modelId: string;

  /**
   * API 키
   */
  apiKey?: string;

  /**
   * 기본 URL
   */
  baseUrl?: string;

  /**
   * 타임아웃 (ms)
   */
  timeout?: number;
};

/**
 * LLM 기능 플래그
 */
export type LlmCapabilities = {
  /**
   * 스트리밍 지원
   */
  streaming: boolean;

  /**
   * 객체 생성 지원
   */
  objectGeneration: boolean;

  /**
   * 툴 호출 지원
   */
  toolCalling: boolean;

  /**
   * 임베딩 지원
   */
  embedding: boolean;
};

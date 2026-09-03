import type { DomainEvent } from "../DomainEvent";

/**
 * 죽은 편지 큐(DLQ)에 저장된 이벤트 항목입니다.
 */
export type DeadLetterItem<TEvent extends DomainEvent = DomainEvent> = {
  /** 원본 이벤트 */
  event: TEvent;

  /** Payload를 포함하지 않는 안정적인 실패 원인 코드 */
  reason: string;

  /** 실패 시간 */
  failedAt: Date;

  /** 재시도 횟수 */
  retryCount: number;

  /** Payload를 포함하지 않는 마지막 오류 분류 */
  lastError?: string;

  /** 재생 시 같은 핸들러를 식별할 수 있는 안정적인 핸들러 식별자 */
  handlerId?: string;

  /** 이벤트 payload를 포함하지 않는 진단·보관 메타데이터 */
  metadata?: Record<string, unknown>;
};

/**
 * DLQ 정책 설정입니다.
 */
export type DeadLetterPolicy = {
  /** 최대 재시도 횟수 (이 횟수를 초과하면 DLQ로 이동) */
  maxRetries: number;

  /** 재시도 간격 (ms) */
  retryDelayMs: number;

  /** 지수 백오프 배율 (1이면 고정 간격, 2면 2배씩 증가) */
  backoffMultiplier: number;

  /** 최대 재시도 간격 (ms, 백오프 상한) */
  maxRetryDelayMs: number;

  /** DLQ 보관 기간 (일) */
  retentionDays: number;
};

/**
 * 기본 DLQ 정책입니다.
 */
export const DEFAULT_DEAD_LETTER_POLICY: DeadLetterPolicy = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  maxRetryDelayMs: 30000,
  retentionDays: 7,
};

/**
 * 죽은 편지 큐(DLQ) 인터페이스입니다.
 * 처리 실패한 이벤트를 저장하고 관리하는 계약을 정의합니다.
 */
export interface DeadLetterQueue {
  /**
   * 이벤트를 DLQ에 저장합니다.
   * 같은 eventId와 handlerId 조합의 활성 항목은 중복 저장하지 않아야 합니다.
   * @param item 저장할 DLQ 항목
   */
  enqueue<TEvent extends DomainEvent>(item: DeadLetterItem<TEvent>): Promise<void>;

  /**
   * DLQ에서 이벤트를 꺼내 재처리합니다.
   * 반환한 항목은 다른 동시 소비자가 다시 받지 않도록 원자적으로 claim하거나 제거해야 합니다.
   * 재처리에 실패한 소비자는 같은 eventId와 handlerId로 항목을 다시 저장해야 합니다.
   * @param limit 최대 조회 개수
   * @returns DLQ 항목 목록
   */
  dequeue<TEvent extends DomainEvent>(limit?: number): Promise<DeadLetterItem<TEvent>[]>;

  /**
   * 특정 항목을 DLQ에서 제거합니다.
   * @param itemId 제거할 항목 ID (event.eventId 또는 별도 ID)
   */
  remove(itemId: string): Promise<void>;

  /**
   * DLQ의 모든 항목을 조회합니다.
   * @returns DLQ 항목 목록
   */
  peek<TEvent extends DomainEvent>(): Promise<DeadLetterItem<TEvent>[]>;

  /**
   * DLQ의 항목 개수를 반환합니다.
   */
  size(): Promise<number>;

  /**
   * DLQ를 비웁니다.
   */
  clear(): Promise<void>;
}

/**
 * 재시도 가능한 이벤트 핸들러를 위한 인터페이스입니다.
 */
export interface RetryableEventHandler {
  /**
   * 핸들러의 재시도 정책을 반환합니다.
   */
  getRetryPolicy(): Partial<DeadLetterPolicy>;

  /**
   * 재시도 횟수를 초과했을 때 호출됩니다.
   * @param event 실패한 이벤트
   * @param error 마지막 에러
   */
  onExhaustedRetries?<TEvent extends DomainEvent>(event: TEvent, error: Error): Promise<void>;
}

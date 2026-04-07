import type { DomainEvent } from '../DomainEvent';

/**
 * 파티션 키 추출 함수 타입입니다.
 */
export type PartitionKeyExtractor<TEvent extends DomainEvent = DomainEvent> = (event: TEvent) => string;

/**
 * 순서 보장 정책입니다.
 */
export type OrderingPolicy = {
  /**
   * 파티션 키를 추출하는 함수입니다.
   * 같은 파티션 키를 가진 이벤트는 순서가 보장됩니다.
   */
  partitionKeyExtractor: PartitionKeyExtractor;

  /**
   * 순서 보장을 위한 버퍼 크기입니다.
   * 버퍼가 꽉 차면 강제로 flush됩니다.
   */
  bufferSize?: number;

  /**
   * 버퍼 flush 타임아웃 (ms)입니다.
   * 이 시간이 지나면 버퍼가 자동으로 flush됩니다.
   */
  flushTimeoutMs?: number;

  /**
   * 최대 동시 처리 수입니다.
   * 같은 파티션 내에서도 이 개수만큼 병렬로 처리됩니다.
   */
  maxConcurrency?: number;
};

/**
 * 순서 보장 이벤트 처리 결과입니다.
 */
export type OrderedEventResult = {
  /** 처리된 이벤트 ID */
  eventId: string;

  /** 처리 성공 여부 */
  success: boolean;

  /** 처리 순서 (파티션 내에서의 순서) */
  sequence: number;

  /** 처리 시간 */
  processedAt: Date;

  /** 에러 (실패한 경우) */
  error?: Error;
};

/**
 * 파티션 상태 정보입니다.
 */
export type PartitionStatus = {
  /** 파티션 키 */
  partitionKey: string;

  /** 대기 중인 이벤트 수 */
  pendingCount: number;

  /** 처리 중인 이벤트 수 */
  processingCount: number;

  /** 마지막 처리 시간 */
  lastProcessedAt?: Date;

  /** 마지막 시퀀스 번호 */
  lastSequence: number;
};

/**
 * 순서 보장 이벤트 버스 인터페이스입니다.
 * 같은 파티션 키를 가진 이벤트의 순서를 보장하는 계약을 정의합니다.
 */
export interface EventOrdering {
  /**
   * 이벤트를 순서대로 발행합니다.
   * 같은 파티션 키를 가진 이벤트는 순서가 보장됩니다.
   * @param event 발행할 이벤트
   * @param partitionKey 파티션 키
   */
  publishOrdered<TEvent extends DomainEvent>(event: TEvent, partitionKey: string): Promise<void>;

  /**
   * 여러 이벤트를 순서대로 발행합니다.
   * @param events 이벤트와 파티션 키의 목록
   */
  publishOrderedMany<TEvent extends DomainEvent>(events: Array<{ event: TEvent; partitionKey: string }>): Promise<void>;

  /**
   * 특정 파티션의 처리 상태를 조회합니다.
   * @param partitionKey 파티션 키
   * @returns 파티션 상태
   */
  getPartitionStatus(partitionKey: string): Promise<PartitionStatus | undefined>;

  /**
   * 모든 파티션의 상태를 조회합니다.
   * @returns 파티션 상태 목록
   */
  getAllPartitionStatus(): Promise<PartitionStatus[]>;

  /**
   * 특정 파티션의 대기 중인 이벤트를 강제로 flush합니다.
   * @param partitionKey 파티션 키
   */
  flushPartition(partitionKey: string): Promise<void>;

  /**
   * 모든 파티션의 대기 중인 이벤트를 강제로 flush합니다.
   */
  flushAll(): Promise<void>;
}

/**
 * 순서 보장 이벤트 핸들러 인터페이스입니다.
 * 순서가 보장된 이벤트 처리를 위한 추가 메서드를 제공합니다.
 */
export interface OrderedEventHandler<TEvent extends DomainEvent = DomainEvent> {
  /**
   * 이벤트를 처리합니다.
   * @param event 처리할 이벤트
   * @param context 순서 컨텍스트
   */
  handle(event: TEvent, context: OrderedEventContext): Promise<void>;

  /**
   * 파티션 키를 추출합니다.
   * @param event 이벤트
   * @returns 파티션 키
   */
  getPartitionKey(event: TEvent): string;
}

/**
 * 순서 보장 이벤트 처리 컨텍스트입니다.
 */
export type OrderedEventContext = {
  /** 파티션 키 */
  partitionKey: string;

  /** 파티션 내 시퀀스 번호 */
  sequence: number;

  /** 이전 이벤트 처리 여부 */
  hasPrevious: boolean;

  /** 다음 이벤트 존재 여부 */
  hasNext: boolean;

  /** 처리 시작 시간 */
  startedAt: Date;
};

/**
 * 이벤트 순서 전략입니다.
 */
export type EventOrderingStrategy = 'sequential' | 'parallel' | 'buffered';

/**
 * 순서 보장 설정입니다.
 */
export type EventOrderingConfig = {
  /** 순서 보장 전략 */
  strategy: EventOrderingStrategy;

  /** 버퍼 크기 (buffered 전략에서 사용) */
  bufferSize?: number;

  /** Flush 타임아웃 (buffered 전략에서 사용) */
  flushTimeoutMs?: number;

  /** 최대 동시 처리 수 (parallel 전략에서 사용) */
  maxConcurrency?: number;

  /** 파티션 키 추출기 */
  partitionKeyExtractor?: PartitionKeyExtractor;
};

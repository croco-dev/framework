import type { DomainEvent } from "../DomainEvent";

/**
 * 이벤트 리플레이(Replay) 모드입니다.
 */
export type ReplayMode = "fast" | "accurate";

/**
 * 이벤트 리플레이 옵션입니다.
 */
export type ReplayOptions = {
  /** 시작 시간 */
  from?: Date;

  /** 종료 시간 */
  to?: Date;

  /** 특정 이벤트 타입만 리플레이 */
  eventTypes?: string[];

  /** 특정 파티션 키만 리플레이 */
  partitionKeys?: string[];

  /** 리플레이 모드 (fast: 속도 우선, accurate: 정확성 우선) */
  mode?: ReplayMode;

  /** 배치 크기 */
  batchSize?: number;

  /** 진행 상황 콜백 */
  onProgress?: (processed: number, total: number) => void;
};

/**
 * 리플레이된 이벤트의 결과입니다.
 */
export type ReplayResult = {
  /** 처리된 이벤트 수 */
  processedCount: number;

  /** 성공한 이벤트 수 */
  successCount: number;

  /** 실패한 이벤트 수 */
  failedCount: number;

  /** 실패한 이벤트 ID 목록 */
  failedEventIds: string[];

  /** 시작 시간 */
  startedAt: Date;

  /** 종료 시간 */
  completedAt: Date;
};

/**
 * 스냅샷 정보입니다.
 */
export type EventSnapshot = {
  /** 스냅샷 ID */
  snapshotId: string;

  /** 스냅샷 생성 시간 */
  createdAt: Date;

  /** 포함된 이벤트 범위 */
  eventRange: {
    from: Date;
    to: Date;
  };

  /** 이벤트 수 */
  eventCount: number;

  /** 메타데이터 */
  metadata?: Record<string, unknown>;
};

/**
 * 이벤트 리플레이(Replay) 인터페이스입니다.
 * 과거 이벤트를 재생성하고 재처리하는 계약을 정의합니다.
 */
export interface EventReplay {
  /**
   * 특정 시점부터 이벤트를 리플레이합니다.
   * @param options 리플레이 옵션
   * @returns 리플레이 결과
   */
  replay(options?: ReplayOptions): Promise<ReplayResult>;

  /**
   * 특정 이벤트만 리플레이합니다.
   * @param eventIds 리플레이할 이벤트 ID 목록
   * @returns 리플레이 결과
   */
  replayEvents(eventIds: string[]): Promise<ReplayResult>;

  /**
   * 현재 상태의 스냅샷을 생성합니다.
   * @param metadata 스냅샷 메타데이터
   * @returns 생성된 스냅샷 정보
   */
  createSnapshot(metadata?: Record<string, unknown>): Promise<EventSnapshot>;

  /**
   * 특정 스냅샷으로 복원합니다.
   * @param snapshotId 복원할 스냅샷 ID
   */
  restoreSnapshot(snapshotId: string): Promise<void>;

  /**
   * 사용 가능한 스냅샷 목록을 조회합니다.
   * @returns 스냅샷 목록
   */
  listSnapshots(): Promise<EventSnapshot[]>;

  /**
   * 특정 스냅샷을 삭제합니다.
   * @param snapshotId 삭제할 스냅샷 ID
   */
  deleteSnapshot(snapshotId: string): Promise<void>;
}

/**
 * 이벤트 저장소 인터페이스입니다.
 * 이벤트 리플레이를 위해 이벤트를 저장하고 조회하는 계약을 정의합니다.
 */
export interface EventStore {
  /**
   * 이벤트를 저장합니다.
   * @param event 저장할 이벤트
   */
  append<TEvent extends DomainEvent>(event: TEvent): Promise<void>;

  /**
   * 여러 이벤트를 저장합니다.
   * @param events 저장할 이벤트 목록
   */
  appendMany<TEvent extends DomainEvent>(events: TEvent[]): Promise<void>;

  /**
   * 특정 조건으로 이벤트를 조회합니다.
   * @param options 조회 옵션
   * @returns 이벤트 목록
   */
  read<TEvent extends DomainEvent>(options?: ReplayOptions): Promise<TEvent[]>;

  /**
   * 특정 이벤트를 ID로 조회합니다.
   * @param eventId 이벤트 ID
   * @returns 이벤트 또는 undefined
   */
  getById<TEvent extends DomainEvent>(eventId: string): Promise<TEvent | undefined>;

  /**
   * 저장된 이벤트 수를 반환합니다.
   */
  count(): Promise<number>;
}

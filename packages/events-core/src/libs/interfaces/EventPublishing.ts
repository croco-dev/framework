import type { DomainEvent } from "../DomainEvent";

/** 이벤트 버스가 지원하는 발행 대기 구간을 취소하는 옵션입니다. 시작된 핸들러 실행은 중단하지 않습니다. */
export type EventPublishOptions = {
  /** 대기 중인 발행에 전달할 취소 신호입니다. */
  signal?: AbortSignal;
};

/**
 * 이벤트 발행 인터페이스입니다.
 * 이벤트 버스에서 이벤트를 발행하는 기능만 제공합니다.
 */
export interface EventPublishing<TEvent extends DomainEvent = DomainEvent> {
  publish(event: TEvent, options?: EventPublishOptions): Promise<void>;
}

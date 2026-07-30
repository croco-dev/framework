import { DomainEvent } from "@croco/events-core";
import { createMeteringEventId } from "./eventIdentity";

/**
 * 사용량 기록 시 발행되는 도메인 이벤트입니다.
 *
 * @description
 * 사용량이 성공적으로 기록되었을 때 발행되는 이벤트입니다.
 *
 * @example
 * ```typescript
 * eventBus.publish(
 *   new UsageRecordedEvent(
 *     "tenant-123",
 *     "api_calls",
 *     1,
 *     "request-123",
 *     { endpoint: "/api/users" },
 *     "operation-123",
 *   ),
 * );
 * ```
 */
export class UsageRecordedEvent extends DomainEvent {
  static eventName = "metering.usage_recorded";

  constructor(
    public readonly tenantId: string,
    public readonly meterId: string,
    public readonly value: number,
    public readonly idempotencyKey: string,
    metadata?: Record<string, unknown>,
    operationId?: string,
  ) {
    void operationId;
    super(createMeteringEventId(UsageRecordedEvent.eventName, tenantId, meterId, idempotencyKey));
    if (metadata !== undefined) {
      this.metadata = { ...this.metadata, ...metadata };
    } else {
      this.metadata = undefined as never;
    }
  }
}

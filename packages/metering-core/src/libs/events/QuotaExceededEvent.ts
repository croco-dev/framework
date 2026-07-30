import { DomainEvent } from "@croco/events-core";
import { createMeteringEventId } from "./eventIdentity";

/**
 * quota 초과 시 발행되는 도메인 이벤트입니다.
 *
 * @description
 * 테넌트의 사용량이 설정된 quota를 초과했을 때 발행되는 이벤트입니다.
 *
 * @example
 * ```typescript
 * eventBus.publish(
 *   new QuotaExceededEvent(
 *     "tenant-123",
 *     "api_calls",
 *     10000,
 *     10000,
 *     "request-123",
 *     "operation-123",
 *   ),
 * );
 * ```
 */
export class QuotaExceededEvent extends DomainEvent {
  static eventName = "metering.quota_exceeded";

  constructor(
    public readonly tenantId: string,
    public readonly meterId: string,
    public readonly currentUsage: number,
    public readonly quota: number,
    idempotencyKey?: string,
    operationId?: string,
  ) {
    void operationId;
    super(
      idempotencyKey === undefined
        ? undefined
        : createMeteringEventId(QuotaExceededEvent.eventName, tenantId, meterId, idempotencyKey),
    );
  }
}

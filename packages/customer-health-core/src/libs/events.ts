import { DomainEvent } from "@croco/events-core";
import type { HealthStatus } from "./types";

export class HealthStatusChangedEvent extends DomainEvent {
  public static eventName = "health.status.changed";

  constructor(
    public readonly tenantId: string,
    public readonly oldStatus: HealthStatus,
    public readonly newStatus: HealthStatus,
    public readonly score: number,
  ) {
    super();
  }
}

export class HealthScoreDroppedEvent extends DomainEvent {
  public static eventName = "health.score.dropped";

  constructor(
    public readonly tenantId: string,
    public readonly previousScore: number,
    public readonly currentScore: number,
    public readonly dropPercentage: number,
  ) {
    super();
  }
}

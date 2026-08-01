import { DomainEvent } from "@croco/events-core";

import type { PlanReleaseState } from "../PlanRelease";
import type { PlanVersionRef } from "../../types";

export class PlanReleaseTransitionedEvent extends DomainEvent {
  static readonly eventName = "billing.plan_release.transitioned";

  constructor(
    public readonly planVersionRef: PlanVersionRef,
    public readonly from: PlanReleaseState | null,
    public readonly to: PlanReleaseState,
    public readonly revision: number,
    public readonly actorId: string,
    public readonly reason: string,
    eventId?: string,
  ) {
    super(eventId);
  }
}

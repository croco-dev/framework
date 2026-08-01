import { DomainEvent } from "@croco/events-core";

import type { PlanReleaseState } from "../PlanRelease";
import type { PlanVersionRef } from "../../types";

/** Records one durable, revision-addressed plan release lifecycle transition. */
export class PlanReleaseTransitionedEvent extends DomainEvent {
  static readonly eventName = "billing.plan_release.transitioned";

  constructor(input: {
    readonly planVersionRef: PlanVersionRef;
    readonly from: PlanReleaseState | null;
    readonly to: PlanReleaseState;
    readonly revision: number;
    readonly actorId: string;
    readonly reason: string;
    readonly eventId?: string;
  }) {
    super(input.eventId);
    this.planVersionRef = input.planVersionRef;
    this.from = input.from;
    this.to = input.to;
    this.revision = input.revision;
    this.actorId = input.actorId;
    this.reason = input.reason;
  }

  readonly planVersionRef: PlanVersionRef;
  readonly from: PlanReleaseState | null;
  readonly to: PlanReleaseState;
  readonly revision: number;
  readonly actorId: string;
  readonly reason: string;
}

import { randomUUID } from "node:crypto";
import type { HealthStatus, TenantHealthScore } from "./types";

export type HealthStatusChangedIntentData = {
  readonly kind: "status_changed";
  readonly tenantId: string;
  readonly oldStatus: HealthStatus;
  readonly newStatus: HealthStatus;
  readonly score: number;
};

export type HealthScoreDroppedIntentData = {
  readonly kind: "score_dropped";
  readonly tenantId: string;
  readonly previousScore: number;
  readonly currentScore: number;
  readonly dropPercentage: number;
};

export type HealthTransitionEventIntent = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly occurredAt: Date;
  readonly data: HealthStatusChangedIntentData | HealthScoreDroppedIntentData;
};

const SCORE_DROP_EVENT_THRESHOLD_PERCENT = 20;

export function createHealthTransitionEventIntents(
  previous: TenantHealthScore | null,
  current: TenantHealthScore,
): readonly HealthTransitionEventIntent[] {
  if (!previous) return [];

  const intents: HealthTransitionEventIntent[] = [];
  if (previous.status !== current.status) {
    intents.push({
      eventId: randomUUID(),
      tenantId: current.tenantId,
      occurredAt: new Date(current.calculatedAt),
      data: {
        kind: "status_changed",
        tenantId: current.tenantId,
        oldStatus: previous.status,
        newStatus: current.status,
        score: current.overallScore,
      },
    });
  }

  const dropPercentage = calculateDropPercentage(previous.overallScore, current.overallScore);
  if (dropPercentage >= SCORE_DROP_EVENT_THRESHOLD_PERCENT) {
    intents.push({
      eventId: randomUUID(),
      tenantId: current.tenantId,
      occurredAt: new Date(current.calculatedAt),
      data: {
        kind: "score_dropped",
        tenantId: current.tenantId,
        previousScore: previous.overallScore,
        currentScore: current.overallScore,
        dropPercentage,
      },
    });
  }

  return intents;
}

export function cloneHealthTransitionEventIntent(
  intent: HealthTransitionEventIntent,
): HealthTransitionEventIntent {
  return {
    ...intent,
    occurredAt: new Date(intent.occurredAt),
    data: { ...intent.data },
  };
}

function calculateDropPercentage(previousScore: number, currentScore: number): number {
  if (previousScore <= 0 || currentScore >= previousScore) return 0;
  return ((previousScore - currentScore) / previousScore) * 100;
}

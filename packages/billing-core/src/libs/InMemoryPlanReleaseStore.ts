import type {
  PlanRelease,
  PlanReleaseLifecycleEvent,
  PlanReleaseStore,
  PlanReleaseStoreSaveOptions,
} from "./PlanRelease";
import type { PlanVersionRef } from "../types";
import {
  OverlappingPlanEffectivePeriodProblem,
  StalePlanReleaseRevisionProblem,
} from "./problems/PlanReleaseProblems";

export class InMemoryPlanReleaseStore implements PlanReleaseStore {
  private readonly releases = new Map<PlanVersionRef, PlanRelease>();
  private readonly pendingEvents = new Map<string, PlanReleaseLifecycleEvent>();

  async create(release: PlanRelease, event: PlanReleaseLifecycleEvent): Promise<void> {
    if (this.releases.has(release.ref)) {
      throw new StalePlanReleaseRevisionProblem(
        release.ref,
        0,
        this.releases.get(release.ref)?.revision ?? 1,
      );
    }
    this.releases.set(release.ref, clonePlanRelease(release));
    this.pendingEvents.set(event.eventId, structuredClone(event));
  }

  async get(ref: PlanVersionRef): Promise<PlanRelease | null> {
    const release = this.releases.get(ref);
    return release ? clonePlanRelease(release) : null;
  }

  async list(planId?: string): Promise<readonly PlanRelease[]> {
    return [...this.releases.values()]
      .filter((release) => planId === undefined || release.definition.planId === planId)
      .sort((left, right) => left.ref.localeCompare(right.ref))
      .map(clonePlanRelease);
  }

  async save(
    release: PlanRelease,
    expectedRevision: number,
    options: PlanReleaseStoreSaveOptions = {},
  ): Promise<void> {
    const current = this.releases.get(release.ref);
    if (!current || current.revision !== expectedRevision) {
      throw new StalePlanReleaseRevisionProblem(
        release.ref,
        expectedRevision,
        current?.revision ?? 0,
      );
    }
    if (options.enforceNoEffectivePeriodOverlap) {
      const conflicting = [...this.releases.values()].find(
        (candidate) =>
          candidate.ref !== release.ref &&
          candidate.definition.planId === release.definition.planId &&
          (candidate.state === "scheduled" ||
            candidate.state === "published" ||
            candidate.publicationIntent !== undefined) &&
          effectivePeriodsConflict(candidate.definition, release.definition),
      );
      if (conflicting) {
        throw new OverlappingPlanEffectivePeriodProblem(release.ref, conflicting.ref);
      }
    }
    this.releases.set(release.ref, clonePlanRelease(release));
    if (options.event) {
      this.pendingEvents.set(options.event.eventId, structuredClone(options.event));
    }
  }

  async listPendingEvents(ref?: PlanVersionRef): Promise<readonly PlanReleaseLifecycleEvent[]> {
    return [...this.pendingEvents.values()]
      .filter((event) => ref === undefined || event.planVersionRef === ref)
      .sort((left, right) => {
        const refDifference = left.planVersionRef.localeCompare(right.planVersionRef);
        return refDifference === 0 ? left.revision - right.revision : refDifference;
      })
      .map((event) => structuredClone(event));
  }

  async markEventPublished(eventId: string): Promise<void> {
    this.pendingEvents.delete(eventId);
  }
}

function clonePlanRelease(release: PlanRelease): PlanRelease {
  return structuredClone(release);
}

function effectivePeriodsConflict(
  left: PlanRelease["definition"],
  right: PlanRelease["definition"],
): boolean {
  const leftStart = Date.parse(left.effectiveAt);
  const rightStart = Date.parse(right.effectiveAt);
  if (leftStart === rightStart) return true;
  if (leftStart < rightStart && left.effectiveUntil === undefined) return false;
  if (rightStart < leftStart && right.effectiveUntil === undefined) return false;

  const leftEnd = left.effectiveUntil ? Date.parse(left.effectiveUntil) : Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil
    ? Date.parse(right.effectiveUntil)
    : Number.POSITIVE_INFINITY;
  return leftStart < rightEnd && rightStart < leftEnd;
}

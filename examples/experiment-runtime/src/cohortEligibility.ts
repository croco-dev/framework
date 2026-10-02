import type { PublishedCohortReader } from "@croco/cohort-core";
import type {
  ExperimentEligibility,
  ExperimentInput,
  ExperimentRegistration,
} from "@croco/features-core";

/** A profile adapter over the published serving snapshot; source systems are never queried here. */
export function cohortExperimentEligibility(
  reader: PublishedCohortReader,
  snapshotId: string,
): ExperimentRegistration["eligibility"] {
  return async (input: ExperimentInput, now: string): Promise<ExperimentEligibility> => {
    if (!input.scope.tenantId) return { status: "unavailable", reason: "cohort_tenant_required" };
    try {
      const publication = await reader.read(
        snapshotId,
        {
          appId: input.scope.app,
          environment: input.scope.environment,
          tenantId: input.scope.tenantId,
        },
        input.subject.kind,
        new Date(now),
      );
      if (!publication.subjectIds.includes(input.subject.id)) {
        return { status: "ineligible", reason: "cohort_subject_not_eligible" };
      }
      return { status: "eligible", snapshotRef: publication.snapshot };
    } catch {
      return { status: "unavailable", reason: "cohort_publication_unavailable" };
    }
  };
}

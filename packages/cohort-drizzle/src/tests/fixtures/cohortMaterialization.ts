import type { CohortMaterialization } from "../../index";

export const scope = { appId: "app", environment: "test", tenantId: "tenant" };
export const input: CohortMaterialization = {
  definition: {
    id: "trial",
    version: 1,
    subjectKind: "customer",
    scope,
    root: {
      kind: "all",
      children: [
        { kind: "fact", field: "plan", operator: "eq", value: "trial" },
        {
          kind: "event",
          event: "report.created",
          metric: "count",
          operator: "eq",
          value: 0,
          windowDays: 7,
        },
      ],
    },
  },
  registration: {
    fields: { plan: { type: "string", operators: ["eq", "ne"], values: ["trial", "paid"] } },
    events: ["report.created"],
    memberships: [],
  },
  context: { scope, subjectKind: "customer", allowedFields: ["plan"] },
  snapshotId: "source-1",
  mapping: {
    table: "cohort_source",
    subjectId: "id",
    snapshotId: "snapshot_id",
    appId: "app_id",
    environment: "environment",
    tenantId: "tenant_id",
    subjectKind: "subject_kind",
    facts: { plan: "plan" },
    events: "events",
    coverage: "coverage",
    memberships: "memberships",
  },
};
export const asOf = "2026-09-20T00:00:00.000Z";

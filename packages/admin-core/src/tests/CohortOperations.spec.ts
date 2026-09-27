import { describe, expect, it } from "vitest";
import {
  assertCohortPreviewRequest,
  assertCohortPublishRequest,
  CohortAdminProblem,
} from "../libs/CohortOperations";
import type { CohortAdminAccess, CohortPreviewRequest } from "../libs/CohortOperations";
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const access: CohortAdminAccess = {
  scope,
  subjectKind: "user",
  permissions: ["cohort.preview", "cohort.explain", "cohort.publish"],
  fields: ["plan"],
};
const request: CohortPreviewRequest = {
  definition: {
    id: "trial",
    version: 1,
    scope,
    subjectKind: "user",
    root: { kind: "not", child: { kind: "fact", field: "plan", operator: "eq", value: "trial" } },
  },
  asOf: "2026-09-27T00:00:00Z",
  sampleLimit: 50,
};
describe("Cohort operations boundary", () => {
  it("accepts an authorized bounded preview", () =>
    expect(() => assertCohortPreviewRequest(request, access)).not.toThrow());
  it.each([0, 51, 1.5, NaN])("rejects invalid sample %s", (sampleLimit) =>
    expect(() => assertCohortPreviewRequest({ ...request, sampleLimit }, access)).toThrow(
      CohortAdminProblem,
    ),
  );
  it("rejects cross tenant and omitted tenant scope", () => {
    for (const tenantId of ["", "other"])
      expect(() =>
        assertCohortPreviewRequest(
          { ...request, definition: { ...request.definition, scope: { ...scope, tenantId } } },
          access,
        ),
      ).toThrow(CohortAdminProblem);
  });
  it("requires explain permission and recursively checks field rights", () => {
    expect(() =>
      assertCohortPreviewRequest(request, { ...access, permissions: ["cohort.preview"] }),
    ).toThrow(CohortAdminProblem);
    expect(() => assertCohortPreviewRequest(request, { ...access, fields: [] })).toThrow(
      CohortAdminProblem,
    );
  });
  it("requires publication permission, audit and CAS revision", () => {
    const publication = {
      definition: request.definition,
      runId: "run",
      actor: "actor",
      reason: "Approved",
      expectedRevision: 0,
      idempotencyKey: "key",
    };
    expect(() => assertCohortPublishRequest(publication, access)).not.toThrow();
    expect(() => assertCohortPublishRequest({ ...publication, reason: "" }, access)).toThrow(
      CohortAdminProblem,
    );
    expect(() =>
      assertCohortPublishRequest({ ...publication, expectedRevision: -1 }, access),
    ).toThrow(CohortAdminProblem);
    expect(() => assertCohortPublishRequest(publication, { ...access, permissions: [] })).toThrow(
      CohortAdminProblem,
    );
  });
});

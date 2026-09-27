import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  CohortDefinition,
  CohortMember,
  CohortRegistration,
  CohortRun,
  CohortScope,
  CohortSnapshot,
} from "@croco/cohort-core";

export const COHORT_PERMISSIONS = {
  preview: "cohort.preview",
  explain: "cohort.explain",
  publish: "cohort.publish",
} as const;
export type CohortAdminAccess = Readonly<{
  scope: CohortScope;
  subjectKind: string;
  permissions: readonly string[];
  fields: readonly string[];
}>;
export type CohortPreviewRequest = Readonly<{
  definition: CohortDefinition;
  asOf: string;
  sampleLimit: number;
}>;
export type CohortExplainRequest = Readonly<{
  definition: CohortDefinition;
  runId: string;
  subjectId: string;
}>;
export type CohortRunRequest = Readonly<{ definition: CohortDefinition; runId: string }>;
export type CohortPublishRequest = Readonly<{
  definition: CohortDefinition;
  runId: string;
  actor: string;
  reason: string;
  expectedRevision: number;
  idempotencyKey: string;
}>;
export type CohortAdminPreview = Readonly<{
  run: CohortRun;
  total: number;
  matched: number;
  unknown: number;
  sample: readonly CohortMember[];
  previousMatched?: number;
}>;
export type CohortAdminHistory = Readonly<{
  snapshot: CohortSnapshot;
  actor: string;
  reason: string;
  memberCount: number;
}>;
export type CohortBuilderState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied" | "failed"; code: string }>
  | Readonly<{
      kind: "ready";
      preview?: CohortAdminPreview;
      history: readonly CohortAdminHistory[];
    }>;
/** Implementations enforce access on the server and return only authorized, masked explanations. */
export interface CohortOperationsAdapter {
  registration(access: CohortAdminAccess): Promise<CohortRegistration>;
  preview(request: CohortPreviewRequest, access: CohortAdminAccess): Promise<CohortAdminPreview>;
  explain(request: CohortExplainRequest, access: CohortAdminAccess): Promise<CohortMember>;
  run(request: CohortRunRequest, access: CohortAdminAccess): Promise<CohortRun>;
  publish(request: CohortPublishRequest, access: CohortAdminAccess): Promise<CohortAdminHistory>;
  history(
    definition: CohortDefinition,
    access: CohortAdminAccess,
  ): Promise<readonly CohortAdminHistory[]>;
}
export class CohortAdminProblem extends Problem {
  constructor(detail: string) {
    super("cohort/admin-invalid", ProblemCategory.ValidationError, detail);
  }
}
export function assertCohortAdminRequest(
  definition: CohortDefinition,
  access: CohortAdminAccess,
  action: keyof typeof COHORT_PERMISSIONS,
): void {
  const scope = definition.scope;
  if (
    !scope.tenantId ||
    scope.appId !== access.scope.appId ||
    scope.environment !== access.scope.environment ||
    scope.tenantId !== access.scope.tenantId ||
    definition.subjectKind !== access.subjectKind ||
    !access.permissions.includes(COHORT_PERMISSIONS[action])
  ) {
    throw new CohortAdminProblem("Cohort scope or permission denied");
  }
  const visit = (node: CohortDefinition["root"]): void => {
    if (node.kind === "fact" && !access.fields.includes(node.field))
      throw new CohortAdminProblem("Cohort field permission denied");
    if (node.kind === "all" || node.kind === "any") node.children.forEach(visit);
    if (node.kind === "not") visit(node.child);
  };
  visit(definition.root);
}
export function assertCohortPreviewRequest(
  request: CohortPreviewRequest,
  access: CohortAdminAccess,
): void {
  assertCohortAdminRequest(request.definition, access, "preview");
  assertCohortAdminRequest(request.definition, access, "explain");
  if (
    !Number.isInteger(request.sampleLimit) ||
    request.sampleLimit < 1 ||
    request.sampleLimit > 50 ||
    !Number.isFinite(Date.parse(request.asOf))
  )
    throw new CohortAdminProblem(
      "Preview requires a valid timestamp and sample limit from 1 to 50",
    );
}
export function assertCohortPublishRequest(
  request: CohortPublishRequest,
  access: CohortAdminAccess,
): void {
  assertCohortAdminRequest(request.definition, access, "publish");
  if (
    !request.runId.trim() ||
    !request.actor.trim() ||
    !request.reason.trim() ||
    !request.idempotencyKey.trim() ||
    !Number.isInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  )
    throw new CohortAdminProblem("Publication requires audit evidence and expected revision");
}

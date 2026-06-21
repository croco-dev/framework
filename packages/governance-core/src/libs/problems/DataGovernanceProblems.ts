import { Problem, ProblemCategory } from "@croco/problems-core";

import type { DataSubjectRequestAuditEvidence } from "../types";

export type DataSubjectProblemInput = {
  readonly resourceKind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly audit: DataSubjectRequestAuditEvidence;
  readonly detail?: string;
};

export class UnsupportedDataExportProblem extends Problem {
  constructor(input: DataSubjectProblemInput) {
    super(
      "governance-core/export-not-supported",
      ProblemCategory.NotImplemented,
      input.detail ??
        `Resource '${input.resourceKind}' does not support subject export for '${input.subjectId}'`,
      {
        extensions: {
          audit: input.audit,
          resourceKind: input.resourceKind,
          subjectId: input.subjectId,
          subjectType: input.subjectType,
        },
      },
    );
  }
}

export class UnsupportedDataDeleteProblem extends Problem {
  constructor(input: DataSubjectProblemInput) {
    super(
      "governance-core/delete-not-supported",
      ProblemCategory.NotImplemented,
      input.detail ??
        `Resource '${input.resourceKind}' does not support subject delete for '${input.subjectId}'`,
      {
        extensions: {
          audit: input.audit,
          resourceKind: input.resourceKind,
          subjectId: input.subjectId,
          subjectType: input.subjectType,
        },
      },
    );
  }
}

export type RetentionPolicyViolationProblemInput = DataSubjectProblemInput & {
  readonly policyId: string;
  readonly retainedUntil: string;
  readonly requestedAt: string;
};

export class RetentionPolicyViolationProblem extends Problem {
  constructor(input: RetentionPolicyViolationProblemInput) {
    super(
      "governance-core/retention-policy-violation",
      ProblemCategory.BusinessRuleViolation,
      input.detail ??
        `Retention policy '${input.policyId}' keeps '${input.resourceKind}' subject '${input.subjectId}' until ${input.retainedUntil}`,
      {
        extensions: {
          audit: input.audit,
          policyId: input.policyId,
          requestedAt: input.requestedAt,
          resourceKind: input.resourceKind,
          retainedUntil: input.retainedUntil,
          subjectId: input.subjectId,
          subjectType: input.subjectType,
        },
      },
    );
  }
}

import { Problem, ProblemCategory } from "@croco/problems-core";

import { RetentionPolicyViolationProblem } from "./problems/DataGovernanceProblems";
import type {
  DataClassificationTag,
  DataGovernanceAuditDescriptor,
  DataGovernanceField,
  DataGovernanceProblemContract,
  DataGovernanceResource,
  DataMapArtifact,
  DataMapCapability,
  DataMapField,
  DataMapProblemContract,
  DataMapProjectSection,
  DataMapResource,
  DataMapSummary,
  DataRetentionPolicy,
  DataSubjectCapabilityDeclaration,
  RetentionPolicyCheck,
} from "./types";

export const DATA_CLASSIFICATION_TAGS = [
  "audit",
  "billing",
  "operational",
  "pii",
  "sensitive",
] as const satisfies readonly DataClassificationTag[];

const DATA_MAP_VERSION = "croco.data-map.v1";
const DEFAULT_DATA_MAP_PATH = ".croco/build/data-map.json";
const CLASSIFICATION_TAG_SET = new Set<string>(DATA_CLASSIFICATION_TAGS);

export const DATA_GOVERNANCE_DIAGNOSTIC_CODES = {
  resourceKindRequired: "governance-core/resource-kind-required",
  resourceLabelRequired: "governance-core/resource-label-required",
  resourceScopeRequired: "governance-core/resource-scope-required",
  subjectTypeRequired: "governance-core/subject-type-required",
  subjectIdFieldRequired: "governance-core/subject-id-field-required",
  subjectFieldUnknown: "governance-core/subject-field-unknown",
  fieldRequired: "governance-core/field-required",
  fieldIdRequired: "governance-core/field-id-required",
  fieldIdDuplicate: "governance-core/field-id-duplicate",
  fieldClassificationRequired: "governance-core/field-classification-required",
  fieldClassificationUnknown: "governance-core/field-classification-unknown",
  fieldCapabilityUnsupported: "governance-core/field-capability-unsupported",
  fieldRetentionPolicyUnknown: "governance-core/field-retention-policy-unknown",
  retentionPolicyIdRequired: "governance-core/retention-policy-id-required",
  retentionPolicyIdDuplicate: "governance-core/retention-policy-id-duplicate",
  retentionPolicyDurationInvalid: "governance-core/retention-policy-duration-invalid",
  retentionPolicyDispositionRequired: "governance-core/retention-policy-disposition-required",
  capabilityHandlerRequired: "governance-core/capability-handler-required",
  capabilityReasonRequired: "governance-core/capability-reason-required",
  capabilityStatusInvalid: "governance-core/capability-status-invalid",
  capabilityStatusRequired: "governance-core/capability-status-required",
  capabilityAuditRequired: "governance-core/capability-audit-required",
  problemCodeRequired: "governance-core/problem-code-required",
  problemCodeDuplicate: "governance-core/problem-code-duplicate",
} as const;

export type DataGovernanceDiagnosticCode =
  (typeof DATA_GOVERNANCE_DIAGNOSTIC_CODES)[keyof typeof DATA_GOVERNANCE_DIAGNOSTIC_CODES];

export type DataGovernanceDiagnosticTarget =
  | "resource"
  | "subject"
  | "field"
  | "retention"
  | "capability"
  | "audit"
  | "problem";

export type DataGovernanceDiagnostic = {
  readonly code: DataGovernanceDiagnosticCode;
  readonly severity: "error";
  readonly target: DataGovernanceDiagnosticTarget;
  readonly message: string;
  readonly path: string;
  readonly resourceKind?: string;
  readonly fieldId?: string;
  readonly retentionPolicyId?: string;
  readonly capability?: "export" | "delete";
  readonly problemCode?: string;
};

export type DataGovernanceValidationReport = {
  readonly valid: boolean;
  readonly diagnostics: readonly DataGovernanceDiagnostic[];
};

type DataSubjectCapabilityCandidate = {
  readonly status?: string;
  readonly handlerId?: string;
  readonly reason?: string;
  readonly audit?: DataGovernanceAuditDescriptor;
  readonly problems?: readonly DataGovernanceProblemContract[];
};

export class DataGovernanceValidationProblem extends Problem {
  readonly diagnostics: readonly DataGovernanceDiagnostic[];

  constructor(report: DataGovernanceValidationReport) {
    super(
      "governance-core/resource-validation-failed",
      ProblemCategory.ValidationError,
      `Data governance resources have ${report.diagnostics.length} invalid contract diagnostic(s)`,
      {
        extensions: {
          diagnostics: report.diagnostics.map(toProblemDiagnostic),
        },
      },
    );
    this.diagnostics = report.diagnostics;
  }
}

export function defineDataGovernanceResource<const TResource extends DataGovernanceResource>(
  resource: TResource,
): TResource {
  return resource;
}

export function validateDataGovernanceResources(
  resources: readonly DataGovernanceResource[],
): DataGovernanceValidationReport {
  const diagnostics = resources.flatMap((resource, resourceIndex) =>
    validateResource(resource, resourceIndex),
  );

  return {
    valid: diagnostics.length === 0,
    diagnostics: diagnostics.sort(compareDiagnostics),
  };
}

export function assertDataGovernanceResourcesValid<
  const TResources extends readonly DataGovernanceResource[],
>(resources: TResources): TResources {
  const report = validateDataGovernanceResources(resources);

  if (!report.valid) {
    throw new DataGovernanceValidationProblem(report);
  }

  return resources;
}

export function createDataMapArtifact(
  resources: readonly DataGovernanceResource[],
  options: { readonly artifactPath?: string } = {},
): DataMapArtifact {
  const report = validateDataGovernanceResources(resources);
  const dataMapResources = resources.map(toDataMapResource).sort(compareDataMapResources);
  const summary = createSummary(dataMapResources, report.diagnostics);

  return {
    version: DATA_MAP_VERSION,
    summary,
    resources: dataMapResources,
    projectMapSection: createProjectMapDataGovernanceSection(
      { summary, resources: dataMapResources },
      options,
    ),
    diagnostics: report.diagnostics.map(toArtifactDiagnostic),
  };
}

export function createProjectMapDataGovernanceSection(
  dataMap: Pick<DataMapArtifact, "summary" | "resources">,
  options: { readonly artifactPath?: string } = {},
): DataMapProjectSection {
  return {
    id: "data-governance",
    title: "Data Governance",
    artifact: {
      kind: "data-map",
      path: options.artifactPath ?? DEFAULT_DATA_MAP_PATH,
      version: DATA_MAP_VERSION,
    },
    summary: dataMap.summary,
    resources: dataMap.resources
      .map((resource) => ({
        kind: resource.kind,
        subjectType: resource.subject.type,
        classifications: resource.classifications,
        retentionPolicyIds: resource.retentionPolicies.map((policy) => policy.id),
        export: resource.capabilities.export.status,
        delete: resource.capabilities.delete.status,
      }))
      .sort((left, right) => compareStrings(left.kind, right.kind)),
  };
}

export function stringifyDataMapArtifact(artifact: DataMapArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function assertRetentionPolicySatisfied(check: RetentionPolicyCheck): void {
  const retainedUntil = toDate(check, "retainedUntil");
  const requestedAt = toDate(check, "requestedAt");

  if (requestedAt.getTime() < retainedUntil.getTime()) {
    throw new RetentionPolicyViolationProblem({
      audit: check.audit,
      policyId: check.policyId,
      requestedAt: requestedAt.toISOString(),
      resourceKind: check.resourceKind,
      retainedUntil: retainedUntil.toISOString(),
      subjectId: check.subjectId,
      subjectType: check.subjectType,
    });
  }
}

function validateResource(
  resource: DataGovernanceResource,
  resourceIndex: number,
): DataGovernanceDiagnostic[] {
  const candidate = resource as Partial<DataGovernanceResource>;
  const resourceKind = normalizeString(candidate.kind);
  const diagnostics: DataGovernanceDiagnostic[] = [];
  const resourcePath = `resources[${resourceIndex}]`;
  const fields = asArray(candidate.fields);
  const retentionPolicies = asArray(candidate.retentionPolicies);
  const retentionPolicyIds = collectRetentionPolicyIds(
    retentionPolicies,
    resourcePath,
    resourceKind,
    diagnostics,
  );
  const fieldIds = collectFieldIds(fields, resourcePath, resourceKind, diagnostics);

  validateRequiredString(
    `${resourcePath}.kind`,
    candidate.kind,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.resourceKindRequired,
    "Data governance resource kind is required",
    "resource",
    diagnostics,
    { resourceKind },
  );
  validateRequiredString(
    `${resourcePath}.label`,
    candidate.label,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.resourceLabelRequired,
    "Data governance resource label is required",
    "resource",
    diagnostics,
    { resourceKind },
  );
  validateRequiredString(
    `${resourcePath}.scope`,
    candidate.scope,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.resourceScopeRequired,
    "Data governance resource scope is required",
    "resource",
    diagnostics,
    { resourceKind },
  );
  validateSubject(candidate.subject, resourcePath, resourceKind, diagnostics);
  validateFields(
    fields,
    retentionPolicyIds,
    candidate.subjectRequests,
    resourcePath,
    resourceKind,
    diagnostics,
  );
  validateCapabilities(candidate.subjectRequests, resourcePath, resourceKind, diagnostics);
  validateProblems(candidate.problems, `${resourcePath}.problems`, resourceKind, diagnostics);

  if (fieldIds.size > 0) {
    validateKnownSubjectField(
      "idField",
      candidate.subject?.idField,
      fieldIds,
      resourcePath,
      resourceKind,
      diagnostics,
    );
    validateKnownSubjectField(
      "tenantField",
      candidate.subject?.tenantField,
      fieldIds,
      resourcePath,
      resourceKind,
      diagnostics,
    );
    validateKnownSubjectField(
      "labelField",
      candidate.subject?.labelField,
      fieldIds,
      resourcePath,
      resourceKind,
      diagnostics,
    );
  }

  return diagnostics;
}

function collectRetentionPolicyIds(
  retentionPolicies: readonly DataRetentionPolicy[],
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const [index, policy] of retentionPolicies.entries()) {
    const policyId = normalizeString(policy.id);
    const path = `${resourcePath}.retentionPolicies[${index}]`;

    if (!policyId) {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyIdRequired,
          message: "Retention policy id is required",
          path: `${path}.id`,
          resourceKind,
          target: "retention",
        }),
      );
    }

    if (policyId && ids.has(policyId) && !duplicateIds.has(policyId)) {
      duplicateIds.add(policyId);
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyIdDuplicate,
          message: `Retention policy '${policyId}' is declared more than once`,
          path: `${path}.id`,
          resourceKind,
          retentionPolicyId: policyId,
          target: "retention",
        }),
      );
    }

    if (!Number.isInteger(policy.durationDays) || policy.durationDays <= 0) {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyDurationInvalid,
          message: `Retention policy '${policyId}' must declare a positive integer durationDays`,
          path: `${path}.durationDays`,
          resourceKind,
          retentionPolicyId: policyId,
          target: "retention",
        }),
      );
    }

    if (!normalizeString(policy.disposition)) {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyDispositionRequired,
          message: `Retention policy '${policyId}' must declare a disposition`,
          path: `${path}.disposition`,
          resourceKind,
          retentionPolicyId: policyId,
          target: "retention",
        }),
      );
    }

    if (policyId) {
      ids.add(policyId);
    }
  }

  return ids;
}

function collectFieldIds(
  fields: readonly DataGovernanceField[],
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): ReadonlySet<string> {
  if (fields.length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldRequired,
        message: "Data governance resource must declare at least one field",
        path: `${resourcePath}.fields`,
        resourceKind,
        target: "field",
      }),
    );
    return new Set();
  }

  const ids = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const [index, field] of fields.entries()) {
    const fieldId = normalizeString(field.id);
    const path = `${resourcePath}.fields[${index}]`;

    if (!fieldId) {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldIdRequired,
          message: "Data governance field id is required",
          path: `${path}.id`,
          resourceKind,
          target: "field",
        }),
      );
      continue;
    }

    if (ids.has(fieldId) && !duplicateIds.has(fieldId)) {
      duplicateIds.add(fieldId);
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldIdDuplicate,
          fieldId,
          message: `Data governance field '${fieldId}' is declared more than once`,
          path: `${path}.id`,
          resourceKind,
          target: "field",
        }),
      );
    }

    ids.add(fieldId);
  }

  return ids;
}

function validateSubject(
  subject: DataGovernanceResource["subject"] | undefined,
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  validateRequiredString(
    `${resourcePath}.subject.type`,
    subject?.type,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTypeRequired,
    "Data governance subject type is required",
    "subject",
    diagnostics,
    { resourceKind },
  );
  validateRequiredString(
    `${resourcePath}.subject.idField`,
    subject?.idField,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectIdFieldRequired,
    "Data governance subject idField is required",
    "subject",
    diagnostics,
    { resourceKind },
  );
}

function validateFields(
  fields: readonly DataGovernanceField[],
  retentionPolicyIds: ReadonlySet<string>,
  subjectRequests: DataGovernanceResource["subjectRequests"] | undefined,
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  for (const [index, field] of fields.entries()) {
    const fieldId = normalizeString(field.id);
    const path = `${resourcePath}.fields[${index}]`;
    const classifications = asArray(field.classifications);

    if (classifications.length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationRequired,
          fieldId,
          message: "Data governance field must declare at least one classification",
          path: `${path}.classifications`,
          resourceKind,
          target: "field",
        }),
      );
    }

    for (const [classificationIndex, classification] of classifications.entries()) {
      if (!CLASSIFICATION_TAG_SET.has(classification)) {
        diagnostics.push(
          createDiagnostic({
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationUnknown,
            fieldId,
            message: `Unknown data classification '${classification}'`,
            path: `${path}.classifications[${classificationIndex}]`,
            resourceKind,
            target: "field",
          }),
        );
      }
    }

    const retentionPolicyId = normalizeString(field.retentionPolicyId);
    if (retentionPolicyId && !retentionPolicyIds.has(retentionPolicyId)) {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldRetentionPolicyUnknown,
          fieldId,
          message: `Data governance field '${fieldId}' references unknown retention policy '${retentionPolicyId}'`,
          path: `${path}.retentionPolicyId`,
          resourceKind,
          retentionPolicyId,
          target: "retention",
        }),
      );
    }

    validateFieldCapability(
      field,
      "exported",
      "export",
      subjectRequests?.export,
      path,
      resourceKind,
      diagnostics,
    );
    validateFieldCapability(
      field,
      "deleted",
      "delete",
      subjectRequests?.delete,
      path,
      resourceKind,
      diagnostics,
    );
  }
}

function validateFieldCapability(
  field: DataGovernanceField,
  flag: "exported" | "deleted",
  capabilityName: "export" | "delete",
  capability: DataSubjectCapabilityDeclaration | undefined,
  fieldPath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  if (field[flag] !== true || capability?.status === "supported") {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      capability: capabilityName,
      code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldCapabilityUnsupported,
      fieldId: normalizeString(field.id),
      message: `Data governance field cannot set ${flag} to true when the ${capabilityName} capability is not supported`,
      path: `${fieldPath}.${flag}`,
      resourceKind,
      target: "field",
    }),
  );
}

function validateCapabilities(
  subjectRequests: DataGovernanceResource["subjectRequests"] | undefined,
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  validateCapability(subjectRequests?.export, "export", resourcePath, resourceKind, diagnostics);
  validateCapability(subjectRequests?.delete, "delete", resourcePath, resourceKind, diagnostics);
}

function validateCapability(
  capability: DataSubjectCapabilityDeclaration | undefined,
  name: "export" | "delete",
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  if (!capability) {
    return;
  }

  const path = `${resourcePath}.subjectRequests.${name}`;
  const candidate = capability as DataSubjectCapabilityCandidate;
  const status = normalizeString(candidate.status);

  if (!status) {
    diagnostics.push(
      createDiagnostic({
        capability: name,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityStatusRequired,
        message: `Data governance ${name} capability must declare status`,
        path: `${path}.status`,
        resourceKind,
        target: "capability",
      }),
    );
    validateProblems(candidate.problems, `${path}.problems`, resourceKind, diagnostics, name);
    return;
  }

  if (status !== "supported" && status !== "not-supported") {
    diagnostics.push(
      createDiagnostic({
        capability: name,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityStatusInvalid,
        message: `Data governance ${name} capability status '${status}' is not supported`,
        path: `${path}.status`,
        resourceKind,
        target: "capability",
      }),
    );
    validateProblems(candidate.problems, `${path}.problems`, resourceKind, diagnostics, name);
    return;
  }

  if (status === "supported") {
    validateRequiredString(
      `${path}.handlerId`,
      candidate.handlerId,
      DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityHandlerRequired,
      `Data governance ${name} capability must declare a handlerId`,
      "capability",
      diagnostics,
      { capability: name, resourceKind },
    );
    validateAudit(candidate.audit, path, name, resourceKind, diagnostics);
  } else {
    validateRequiredString(
      `${path}.reason`,
      candidate.reason,
      DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityReasonRequired,
      `Data governance ${name} capability must declare why it is not supported`,
      "capability",
      diagnostics,
      { capability: name, resourceKind },
    );
  }

  validateProblems(candidate.problems, `${path}.problems`, resourceKind, diagnostics, name);
}

function validateAudit(
  audit: DataGovernanceAuditDescriptor | undefined,
  capabilityPath: string,
  capability: "export" | "delete",
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  if (!audit || !normalizeString(audit.eventName) || !normalizeString(audit.subjectType)) {
    diagnostics.push(
      createDiagnostic({
        capability,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityAuditRequired,
        message: `Data governance ${capability} capability audit must include eventName and subjectType`,
        path: `${capabilityPath}.audit`,
        resourceKind,
        target: "audit",
      }),
    );
  }
}

function validateKnownSubjectField(
  fieldName: "idField" | "tenantField" | "labelField",
  fieldId: string | undefined,
  fieldIds: ReadonlySet<string>,
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  const normalizedFieldId = normalizeString(fieldId);
  if (!normalizedFieldId || fieldIds.has(normalizedFieldId)) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectFieldUnknown,
      fieldId: normalizedFieldId,
      message: `Data governance subject ${fieldName} '${normalizedFieldId}' is not declared in fields`,
      path: `${resourcePath}.subject.${fieldName}`,
      resourceKind,
      target: "subject",
    }),
  );
}

function validateProblems(
  problems: readonly DataGovernanceProblemContract[] | undefined,
  path: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
  capability?: "export" | "delete",
): void {
  const contracts = asArray(problems);
  const codes = new Set<string>();
  const duplicateCodes = new Set<string>();

  for (const [index, problem] of contracts.entries()) {
    const problemCode = normalizeString(problem.code);

    if (!problemCode) {
      diagnostics.push(
        createDiagnostic({
          capability,
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.problemCodeRequired,
          message: "Data governance Problem contract code is required",
          path: `${path}[${index}].code`,
          resourceKind,
          target: "problem",
        }),
      );
      continue;
    }

    if (codes.has(problemCode) && !duplicateCodes.has(problemCode)) {
      duplicateCodes.add(problemCode);
      diagnostics.push(
        createDiagnostic({
          capability,
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.problemCodeDuplicate,
          message: `Data governance Problem contract '${problemCode}' is declared more than once`,
          path: `${path}[${index}].code`,
          problemCode,
          resourceKind,
          target: "problem",
        }),
      );
    }

    codes.add(problemCode);
  }
}

function toDataMapResource(resource: DataGovernanceResource): DataMapResource {
  const exportCapability = toDataMapCapability("export", resource.subjectRequests?.export);
  const deleteCapability = toDataMapCapability("delete", resource.subjectRequests?.delete);
  const fields = resource.fields
    .map((field) =>
      toDataMapField(
        field,
        exportCapability.status === "supported",
        deleteCapability.status === "supported",
      ),
    )
    .sort(compareDataMapFields);
  const retentionPolicies = [...(resource.retentionPolicies ?? [])].sort(compareRetentionPolicies);
  const problems = dedupeProblems([
    ...normalizeProblemContracts(resource.problems ?? []),
    ...exportCapability.problems,
    ...deleteCapability.problems,
    ...(retentionPolicies.length > 0 ? [defaultRetentionViolationProblem()] : []),
  ]);

  return {
    kind: resource.kind,
    label: resource.label,
    scope: resource.scope,
    subject: resource.subject,
    classifications: collectClassifications(fields),
    fields,
    retentionPolicies,
    capabilities: {
      export: exportCapability,
      delete: deleteCapability,
    },
    problems,
    ...(resource.description ? { description: resource.description } : {}),
  };
}

function toDataMapField(
  field: DataGovernanceField,
  exportSupported: boolean,
  deleteSupported: boolean,
): DataMapField {
  return {
    id: field.id,
    classifications: sortClassifications(field.classifications),
    exported: exportSupported && field.exported !== false,
    deleted: deleteSupported && field.deleted !== false,
    ...(field.label ? { label: field.label } : {}),
    ...(field.valueType ? { valueType: field.valueType } : {}),
    ...(field.retentionPolicyId ? { retentionPolicyId: field.retentionPolicyId } : {}),
    ...(field.source ? { source: field.source } : {}),
    ...(field.description ? { description: field.description } : {}),
  };
}

function toDataMapCapability(
  name: "export" | "delete",
  capability: DataSubjectCapabilityDeclaration | undefined,
): DataMapCapability {
  if (!capability) {
    return {
      status: "not-supported",
      reason: "Capability is not declared",
      problems: [defaultUnsupportedCapabilityProblem(name)],
    };
  }

  const candidate = capability as DataSubjectCapabilityCandidate;

  if (candidate.status === "not-supported") {
    return {
      status: "not-supported",
      ...(candidate.reason ? { reason: candidate.reason } : {}),
      ...(candidate.audit ? { audit: candidate.audit } : {}),
      problems: dedupeProblems([
        defaultUnsupportedCapabilityProblem(name),
        ...normalizeProblemContracts(candidate.problems ?? []),
      ]),
    };
  }

  if (candidate.status === "supported") {
    return {
      status: "supported",
      ...(candidate.handlerId ? { handlerId: candidate.handlerId } : {}),
      ...(candidate.audit ? { audit: candidate.audit } : {}),
      problems: normalizeProblemContracts(candidate.problems ?? []).sort(compareProblems),
    };
  }

  return {
    status: "not-supported",
    reason: candidate.status
      ? `Capability status '${candidate.status}' is invalid`
      : "Capability status is not declared",
    problems: [defaultUnsupportedCapabilityProblem(name)],
  };
}

function normalizeProblemContracts(
  problems: readonly DataGovernanceProblemContract[],
): DataMapProblemContract[] {
  return problems.map((problem) => ({
    code: problem.code,
    category: problem.category ?? "InternalServerError",
    status: problem.status ?? 500,
    title: problem.title ?? "Internal Server Error",
    ...(problem.detail ? { detail: problem.detail } : {}),
    ...(problem.retryable !== undefined ? { retryable: problem.retryable } : {}),
    ...(problem.metadata ? { metadata: problem.metadata } : {}),
  }));
}

function defaultUnsupportedCapabilityProblem(
  capability: "export" | "delete",
): DataMapProblemContract {
  return {
    code:
      capability === "export"
        ? "governance-core/export-not-supported"
        : "governance-core/delete-not-supported",
    category: "NotImplemented",
    status: 501,
    title: "Not Implemented",
  };
}

function defaultRetentionViolationProblem(): DataMapProblemContract {
  return {
    code: "governance-core/retention-policy-violation",
    category: "BusinessRuleViolation",
    status: 422,
    title: "Business Rule Violation",
  };
}

function createSummary(
  resources: readonly DataMapResource[],
  diagnostics: readonly DataGovernanceDiagnostic[],
): DataMapSummary {
  const fields = resources.flatMap((resource) => resource.fields);

  return {
    resources: resources.length,
    fields: fields.length,
    piiFields: fields.filter((field) => field.classifications.includes("pii")).length,
    retentionPolicies: resources.reduce(
      (sum, resource) => sum + resource.retentionPolicies.length,
      0,
    ),
    exportSupported: resources.filter(
      (resource) => resource.capabilities.export.status === "supported",
    ).length,
    deleteSupported: resources.filter(
      (resource) => resource.capabilities.delete.status === "supported",
    ).length,
    diagnostics: diagnostics.length,
  };
}

function toArtifactDiagnostic(
  diagnostic: DataGovernanceDiagnostic,
): DataMapArtifact["diagnostics"][number] {
  return {
    code: diagnostic.code,
    path: diagnostic.path,
    message: diagnostic.message,
    ...(diagnostic.resourceKind ? { resourceKind: diagnostic.resourceKind } : {}),
  };
}

function toProblemDiagnostic(diagnostic: DataGovernanceDiagnostic): DataGovernanceDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    target: diagnostic.target,
    message: diagnostic.message,
    path: diagnostic.path,
    ...(diagnostic.resourceKind !== undefined ? { resourceKind: diagnostic.resourceKind } : {}),
    ...(diagnostic.fieldId !== undefined ? { fieldId: diagnostic.fieldId } : {}),
    ...(diagnostic.retentionPolicyId !== undefined
      ? { retentionPolicyId: diagnostic.retentionPolicyId }
      : {}),
    ...(diagnostic.capability !== undefined ? { capability: diagnostic.capability } : {}),
    ...(diagnostic.problemCode !== undefined ? { problemCode: diagnostic.problemCode } : {}),
  };
}

function collectClassifications(fields: readonly DataMapField[]): DataClassificationTag[] {
  return sortClassifications(fields.flatMap((field) => field.classifications));
}

function sortClassifications(
  classifications: readonly DataClassificationTag[],
): DataClassificationTag[] {
  return [...new Set(classifications)].sort(compareStrings);
}

function dedupeProblems(problems: readonly DataMapProblemContract[]): DataMapProblemContract[] {
  const byCode = new Map<string, DataMapProblemContract>();

  for (const problem of problems) {
    if (!byCode.has(problem.code)) {
      byCode.set(problem.code, problem);
    }
  }

  return [...byCode.values()].sort(compareProblems);
}

function createDiagnostic(
  input: Omit<DataGovernanceDiagnostic, "severity">,
): DataGovernanceDiagnostic {
  return {
    ...input,
    severity: "error",
  };
}

function validateRequiredString(
  path: string,
  value: string | undefined,
  code: DataGovernanceDiagnosticCode,
  message: string,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: Pick<DataGovernanceDiagnostic, "capability" | "resourceKind"> = {},
): void {
  if (normalizeString(value)) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      ...context,
      code,
      message,
      path,
      target,
    }),
  );
}

function normalizeString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function asArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function toDate(check: RetentionPolicyCheck, fieldName: "requestedAt" | "retainedUntil"): Date {
  const value = check[fieldName];
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RetentionPolicyViolationProblem({
      audit: check.audit,
      policyId: check.policyId,
      requestedAt: stringifyTimestamp(check.requestedAt),
      resourceKind: check.resourceKind,
      retainedUntil: stringifyTimestamp(check.retainedUntil),
      subjectId: check.subjectId,
      subjectType: check.subjectType,
      detail: `Invalid retention policy timestamp '${String(value)}'`,
    });
  }

  return date;
}

function stringifyTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function compareDataMapResources(left: DataMapResource, right: DataMapResource): number {
  return compareStrings(left.kind, right.kind);
}

function compareDataMapFields(left: DataMapField, right: DataMapField): number {
  return compareStrings(left.id, right.id);
}

function compareRetentionPolicies(left: DataRetentionPolicy, right: DataRetentionPolicy): number {
  return compareStrings(left.id, right.id);
}

function compareProblems(left: DataMapProblemContract, right: DataMapProblemContract): number {
  return compareStrings(left.code, right.code);
}

function compareDiagnostics(
  left: DataGovernanceDiagnostic,
  right: DataGovernanceDiagnostic,
): number {
  return (
    compareStrings(left.path, right.path) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

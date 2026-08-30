import { Problem, ProblemCategory } from "@croco/problems-core";

import { RetentionPolicyViolationProblem } from "./problems/DataGovernanceProblems";
import type {
  DataClassificationTag,
  DataGovernanceAuditDescriptor,
  DataGovernanceResource,
  DataMapArtifact,
  DataMapCapability,
  DataMapField,
  DataMapProblemContract,
  DataMapProjectSection,
  DataMapResource,
  DataMapSummary,
  DataRetentionPolicy,
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
  arrayShapeInvalid: "governance-core/array-shape-invalid",
  objectShapeInvalid: "governance-core/object-shape-invalid",
  valueInvalid: "governance-core/value-invalid",
  resourceKindRequired: "governance-core/resource-kind-required",
  resourceLabelRequired: "governance-core/resource-label-required",
  resourceScopeRequired: "governance-core/resource-scope-required",
  subjectTypeRequired: "governance-core/subject-type-required",
  subjectIdFieldRequired: "governance-core/subject-id-field-required",
  subjectTenantFieldRequired: "governance-core/subject-tenant-field-required",
  subjectTenantFieldTypeInvalid: "governance-core/subject-tenant-field-type-invalid",
  subjectTenantIdentifierOverrideReasonRequired:
    "governance-core/subject-tenant-identifier-override-reason-required",
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

type UnknownRecord = Readonly<Record<string, unknown>>;

type DataSubjectCapabilityCandidate = {
  readonly status?: unknown;
  readonly handlerId?: unknown;
  readonly reason?: unknown;
  readonly audit?: UnknownRecord;
  readonly problems: readonly UnknownRecord[];
  readonly metadata?: unknown;
};

type NormalizedDataGovernanceResource = {
  readonly kind?: unknown;
  readonly label?: unknown;
  readonly scope?: unknown;
  readonly subject: UnknownRecord;
  readonly fields: readonly UnknownRecord[];
  readonly retentionPolicies: readonly UnknownRecord[];
  readonly subjectRequests?: {
    readonly export?: DataSubjectCapabilityCandidate;
    readonly delete?: DataSubjectCapabilityCandidate;
  };
  readonly problems: readonly UnknownRecord[];
  readonly description?: unknown;
  readonly metadata?: unknown;
};

type DataGovernanceInspection = {
  readonly report: DataGovernanceValidationReport;
  readonly resources: readonly NormalizedDataGovernanceResource[];
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
  return inspectDataGovernanceResources(resources).report;
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
  const { report, resources: normalizedResources } = inspectDataGovernanceResources(resources);
  const invalidCapabilityPaths = collectInvalidCapabilityPaths(report.diagnostics);
  const dataMapResources = normalizedResources
    .map((resource, resourceIndex) =>
      toDataMapResource(resource, resourceIndex, invalidCapabilityPaths),
    )
    .sort(compareDataMapResources);
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

function inspectDataGovernanceResources(resources: unknown): DataGovernanceInspection {
  const diagnostics: DataGovernanceDiagnostic[] = [];
  const candidates = readArray(resources, "resources", "resource", diagnostics, true).map(
    (resource, resourceIndex) => normalizeResource(resource, resourceIndex, diagnostics),
  );

  for (const [resourceIndex, resource] of candidates.entries()) {
    validateResource(resource, resourceIndex, diagnostics);
  }

  diagnostics.sort(compareDiagnostics);

  return {
    report: {
      valid: diagnostics.length === 0,
      diagnostics,
    },
    resources: candidates,
  };
}

function normalizeResource(
  resource: unknown,
  resourceIndex: number,
  diagnostics: DataGovernanceDiagnostic[],
): NormalizedDataGovernanceResource {
  const resourcePath = `resources[${resourceIndex}]`;
  const candidate = readObject(resource, resourcePath, "resource", diagnostics, true) ?? {};
  const resourceKind = normalizeString(candidate.kind);
  const subject = readObject(
    candidate.subject,
    `${resourcePath}.subject`,
    "subject",
    diagnostics,
    true,
    resourceKind,
  );
  const fields = readObjectArray(
    candidate.fields,
    `${resourcePath}.fields`,
    "field",
    diagnostics,
    true,
    resourceKind,
  );
  const retentionPolicies = readObjectArray(
    candidate.retentionPolicies,
    `${resourcePath}.retentionPolicies`,
    "retention",
    diagnostics,
    false,
    resourceKind,
  );
  const subjectRequests = normalizeSubjectRequests(
    candidate.subjectRequests,
    resourcePath,
    resourceKind,
    diagnostics,
  );
  const problems = readObjectArray(
    candidate.problems,
    `${resourcePath}.problems`,
    "problem",
    diagnostics,
    false,
    resourceKind,
  );

  for (const [fieldIndex, field] of fields.entries()) {
    readArray(
      field.classifications,
      `${resourcePath}.fields[${fieldIndex}].classifications`,
      "field",
      diagnostics,
      true,
      resourceKind,
    );
  }

  return {
    kind: candidate.kind,
    label: candidate.label,
    scope: candidate.scope,
    subject: subject ?? {},
    fields,
    retentionPolicies,
    subjectRequests,
    problems,
    description: candidate.description,
    metadata: candidate.metadata,
  };
}

function normalizeSubjectRequests(
  value: unknown,
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): NormalizedDataGovernanceResource["subjectRequests"] {
  const path = `${resourcePath}.subjectRequests`;
  const subjectRequests = readObject(value, path, "capability", diagnostics, false, resourceKind);

  if (!subjectRequests) {
    return undefined;
  }

  const exportCapability = normalizeCapability(
    subjectRequests.export,
    `${path}.export`,
    "export",
    resourceKind,
    diagnostics,
  );
  const deleteCapability = normalizeCapability(
    subjectRequests.delete,
    `${path}.delete`,
    "delete",
    resourceKind,
    diagnostics,
  );

  return {
    ...(exportCapability ? { export: exportCapability } : {}),
    ...(deleteCapability ? { delete: deleteCapability } : {}),
  };
}

function normalizeCapability(
  value: unknown,
  path: string,
  name: "export" | "delete",
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): DataSubjectCapabilityCandidate | undefined {
  const capability = readObject(value, path, "capability", diagnostics, false, resourceKind, name);

  if (!capability) {
    return undefined;
  }

  const audit = readObject(
    capability.audit,
    `${path}.audit`,
    "audit",
    diagnostics,
    false,
    resourceKind,
    name,
  );
  const problems = readObjectArray(
    capability.problems,
    `${path}.problems`,
    "problem",
    diagnostics,
    false,
    resourceKind,
    name,
  );

  return {
    status: capability.status,
    handlerId: capability.handlerId,
    reason: capability.reason,
    audit,
    problems,
    metadata: capability.metadata,
  };
}

function validateResource(
  candidate: NormalizedDataGovernanceResource,
  resourceIndex: number,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  const resourceKind = normalizeString(candidate.kind);
  const resourcePath = `resources[${resourceIndex}]`;
  const retentionPolicyIds = collectRetentionPolicyIds(
    candidate.retentionPolicies,
    resourcePath,
    resourceKind,
    diagnostics,
  );
  const fieldIds = collectFieldIds(candidate.fields, resourcePath, resourceKind, diagnostics);

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
    candidate.fields,
    retentionPolicyIds,
    candidate.subjectRequests,
    resourcePath,
    resourceKind,
    diagnostics,
  );
  validateCapabilities(candidate.subjectRequests, resourcePath, resourceKind, diagnostics);
  validateProblems(candidate.problems, `${resourcePath}.problems`, resourceKind, diagnostics);
  validateTenantField(
    candidate.scope,
    candidate.subject,
    candidate.fields,
    resourcePath,
    resourceKind,
    diagnostics,
  );
  validateOptionalString(
    `${resourcePath}.description`,
    candidate.description,
    "resource",
    diagnostics,
    {
      resourceKind,
    },
  );
  validateOptionalRecord(`${resourcePath}.metadata`, candidate.metadata, "resource", diagnostics, {
    resourceKind,
  });

  if (fieldIds.size > 0) {
    validateKnownSubjectField(
      "idField",
      candidate.subject.idField,
      fieldIds,
      resourcePath,
      resourceKind,
      diagnostics,
    );
    validateKnownSubjectField(
      "labelField",
      candidate.subject.labelField,
      fieldIds,
      resourcePath,
      resourceKind,
      diagnostics,
    );
  }
}

function validateTenantField(
  scope: unknown,
  subject: UnknownRecord,
  fields: readonly UnknownRecord[],
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  const tenantFieldId = subject.tenantField;
  const normalizedTenantFieldId = normalizeString(tenantFieldId);
  if (!normalizedTenantFieldId) {
    if (normalizeString(scope) === "tenant") {
      diagnostics.push(
        createDiagnostic({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantFieldRequired,
          message: "Tenant-scoped data governance resources must declare subject.tenantField",
          path: `${resourcePath}.subject.tenantField`,
          resourceKind,
          target: "subject",
        }),
      );
    }
    return;
  }

  const tenantFieldIndex = fields.findIndex((field) => field.id === tenantFieldId);
  const tenantField = fields[tenantFieldIndex];
  if (!tenantField) {
    diagnostics.push(
      createDiagnostic({
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectFieldUnknown,
        fieldId: normalizedTenantFieldId,
        message: `Data governance subject tenantField '${normalizedTenantFieldId}' is not declared in fields`,
        path: `${resourcePath}.subject.tenantField`,
        resourceKind,
        target: "subject",
      }),
    );
    return;
  }

  if (normalizeString(scope) !== "tenant") {
    return;
  }

  const valueType = normalizeString(tenantField.valueType);
  if (tenantField.valueType === "identifier") {
    return;
  }

  if (valueType && isRecord(subject.tenantIdentifierOverride)) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantFieldTypeInvalid,
      fieldId: normalizedTenantFieldId,
      message: `Tenant field '${normalizedTenantFieldId}' must declare valueType 'identifier'`,
      path: `${resourcePath}.fields[${tenantFieldIndex}].valueType`,
      resourceKind,
      target: "field",
    }),
  );
}

function collectRetentionPolicyIds(
  retentionPolicies: readonly UnknownRecord[],
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

    if (!isPositiveInteger(policy.durationDays)) {
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
    } else {
      validateOptionalEnum(
        `${path}.disposition`,
        policy.disposition,
        ["delete", "anonymize", "archive", "manual-review"],
        "retention",
        diagnostics,
        { resourceKind },
      );
    }

    validateOptionalString(`${path}.basis`, policy.basis, "retention", diagnostics, {
      resourceKind,
    });
    validateOptionalString(`${path}.startsFrom`, policy.startsFrom, "retention", diagnostics, {
      resourceKind,
    });
    validateOptionalEnum(
      `${path}.legalHold`,
      policy.legalHold,
      ["block-delete", "preserve"],
      "retention",
      diagnostics,
      { resourceKind },
    );
    validateOptionalRecord(`${path}.metadata`, policy.metadata, "retention", diagnostics, {
      resourceKind,
    });

    if (policyId) {
      ids.add(policyId);
    }
  }

  return ids;
}

function collectFieldIds(
  fields: readonly UnknownRecord[],
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
  subject: UnknownRecord,
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  validateRequiredString(
    `${resourcePath}.subject.type`,
    subject.type,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTypeRequired,
    "Data governance subject type is required",
    "subject",
    diagnostics,
    { resourceKind },
  );
  validateRequiredString(
    `${resourcePath}.subject.idField`,
    subject.idField,
    DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectIdFieldRequired,
    "Data governance subject idField is required",
    "subject",
    diagnostics,
    { resourceKind },
  );
  validateOptionalString(
    `${resourcePath}.subject.tenantField`,
    subject.tenantField,
    "subject",
    diagnostics,
    { resourceKind },
  );
  validateOptionalRecord(
    `${resourcePath}.subject.tenantIdentifierOverride`,
    subject.tenantIdentifierOverride,
    "subject",
    diagnostics,
    { resourceKind },
  );
  if (isRecord(subject.tenantIdentifierOverride)) {
    validateRequiredString(
      `${resourcePath}.subject.tenantIdentifierOverride.reason`,
      subject.tenantIdentifierOverride.reason,
      DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantIdentifierOverrideReasonRequired,
      "Tenant identifier override must declare a reason",
      "subject",
      diagnostics,
      { resourceKind },
    );
  }
  validateOptionalString(
    `${resourcePath}.subject.labelField`,
    subject.labelField,
    "subject",
    diagnostics,
    { resourceKind },
  );
}

function validateFields(
  fields: readonly UnknownRecord[],
  retentionPolicyIds: ReadonlySet<string>,
  subjectRequests: NormalizedDataGovernanceResource["subjectRequests"],
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
      if (typeof classification !== "string" || !CLASSIFICATION_TAG_SET.has(classification)) {
        diagnostics.push(
          createDiagnostic({
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationUnknown,
            fieldId,
            message: "Data governance field declares an unknown classification",
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

    validateOptionalString(`${path}.label`, field.label, "field", diagnostics, {
      resourceKind,
    });
    validateOptionalString(`${path}.valueType`, field.valueType, "field", diagnostics, {
      resourceKind,
    });
    validateOptionalString(
      `${path}.retentionPolicyId`,
      field.retentionPolicyId,
      "field",
      diagnostics,
      { resourceKind },
    );
    validateOptionalBoolean(`${path}.exported`, field.exported, "field", diagnostics, {
      resourceKind,
    });
    validateOptionalBoolean(`${path}.deleted`, field.deleted, "field", diagnostics, {
      resourceKind,
    });
    validateOptionalString(`${path}.source`, field.source, "field", diagnostics, {
      resourceKind,
    });
    validateOptionalString(`${path}.description`, field.description, "field", diagnostics, {
      resourceKind,
    });
    validateOptionalRecord(`${path}.metadata`, field.metadata, "field", diagnostics, {
      resourceKind,
    });

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
  field: UnknownRecord,
  flag: "exported" | "deleted",
  capabilityName: "export" | "delete",
  capability: DataSubjectCapabilityCandidate | undefined,
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
  subjectRequests: NormalizedDataGovernanceResource["subjectRequests"],
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  validateCapability(subjectRequests?.export, "export", resourcePath, resourceKind, diagnostics);
  validateCapability(subjectRequests?.delete, "delete", resourcePath, resourceKind, diagnostics);
}

function validateCapability(
  capability: DataSubjectCapabilityCandidate | undefined,
  name: "export" | "delete",
  resourcePath: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  if (!capability) {
    return;
  }

  const path = `${resourcePath}.subjectRequests.${name}`;
  const status = capability.status;

  if (status === undefined || status === "") {
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
  } else if (status !== "supported" && status !== "not-supported") {
    diagnostics.push(
      createDiagnostic({
        capability: name,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityStatusInvalid,
        message: `Data governance ${name} capability status is invalid`,
        path: `${path}.status`,
        resourceKind,
        target: "capability",
      }),
    );
  }

  if (status === "supported") {
    validateRequiredString(
      `${path}.handlerId`,
      capability.handlerId,
      DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityHandlerRequired,
      `Data governance ${name} capability must declare a handlerId`,
      "capability",
      diagnostics,
      { capability: name, resourceKind },
    );
    validateAudit(capability.audit, path, name, resourceKind, diagnostics);
  } else if (status === "not-supported") {
    validateRequiredString(
      `${path}.reason`,
      capability.reason,
      DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityReasonRequired,
      `Data governance ${name} capability must declare why it is not supported`,
      "capability",
      diagnostics,
      { capability: name, resourceKind },
    );
  }

  if (status !== "supported" && capability.audit) {
    validateAudit(capability.audit, path, name, resourceKind, diagnostics);
  }

  validateProblems(capability.problems, `${path}.problems`, resourceKind, diagnostics, name);
  validateOptionalRecord(`${path}.metadata`, capability.metadata, "capability", diagnostics, {
    capability: name,
    resourceKind,
  });
}

function validateAudit(
  audit: UnknownRecord | undefined,
  capabilityPath: string,
  capability: "export" | "delete",
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
): void {
  if (!audit) {
    diagnostics.push(
      createDiagnostic({
        capability,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityAuditRequired,
        message: `Data governance ${capability} capability audit must include valid eventName, subjectType, and actor`,
        path: `${capabilityPath}.audit`,
        resourceKind,
        target: "audit",
      }),
    );
    return;
  }

  const path = `${capabilityPath}.audit`;
  const diagnosticCount = diagnostics.length;
  validateRequiredValue(
    `${path}.eventName`,
    audit.eventName,
    (value) => typeof value === "string" && value.trim().length > 0,
    "audit",
    diagnostics,
    { capability, resourceKind },
  );
  validateRequiredValue(
    `${path}.subjectType`,
    audit.subjectType,
    (value) => typeof value === "string" && value.trim().length > 0,
    "audit",
    diagnostics,
    { capability, resourceKind },
  );
  validateRequiredValue(
    `${path}.actor`,
    audit.actor,
    (value) => value === "required" || value === "optional" || value === "system",
    "audit",
    diagnostics,
    { capability, resourceKind },
  );
  validateOptionalEnum(
    `${path}.reason`,
    audit.reason,
    ["required", "optional"],
    "audit",
    diagnostics,
    { capability, resourceKind },
  );
  validateOptionalEnum(
    `${path}.idempotencyKey`,
    audit.idempotencyKey,
    ["required", "optional"],
    "audit",
    diagnostics,
    { capability, resourceKind },
  );
  validateOptionalRecord(`${path}.metadata`, audit.metadata, "audit", diagnostics, {
    capability,
    resourceKind,
  });

  if (diagnostics.length > diagnosticCount) {
    diagnostics.push(
      createDiagnostic({
        capability,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityAuditRequired,
        message: `Data governance ${capability} capability audit declaration is invalid`,
        path,
        resourceKind,
        target: "audit",
      }),
    );
  }
}

function validateKnownSubjectField(
  fieldName: "idField" | "tenantField" | "labelField",
  fieldId: unknown,
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
  problems: readonly UnknownRecord[],
  path: string,
  resourceKind: string | undefined,
  diagnostics: DataGovernanceDiagnostic[],
  capability?: "export" | "delete",
): void {
  const codes = new Set<string>();
  const duplicateCodes = new Set<string>();

  for (const [index, problem] of problems.entries()) {
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
    } else if (codes.has(problemCode) && !duplicateCodes.has(problemCode)) {
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

    if (problemCode) {
      codes.add(problemCode);
    }

    const problemPath = `${path}[${index}]`;
    validateOptionalString(`${problemPath}.category`, problem.category, "problem", diagnostics, {
      capability,
      resourceKind,
    });
    validateOptionalNumber(`${problemPath}.status`, problem.status, "problem", diagnostics, {
      capability,
      resourceKind,
    });
    validateOptionalString(`${problemPath}.title`, problem.title, "problem", diagnostics, {
      capability,
      resourceKind,
    });
    validateOptionalString(`${problemPath}.detail`, problem.detail, "problem", diagnostics, {
      capability,
      resourceKind,
    });
    validateOptionalBoolean(`${problemPath}.retryable`, problem.retryable, "problem", diagnostics, {
      capability,
      resourceKind,
    });
    validateOptionalRecord(`${problemPath}.metadata`, problem.metadata, "problem", diagnostics, {
      capability,
      resourceKind,
    });
  }
}

function toDataMapResource(
  resource: NormalizedDataGovernanceResource,
  resourceIndex: number,
  invalidCapabilityPaths: ReadonlySet<string>,
): DataMapResource {
  const exportPath = `resources[${resourceIndex}].subjectRequests.export`;
  const deletePath = `resources[${resourceIndex}].subjectRequests.delete`;
  const exportCapability = toDataMapCapability(
    "export",
    resource.subjectRequests?.export,
    !invalidCapabilityPaths.has(exportPath),
  );
  const deleteCapability = toDataMapCapability(
    "delete",
    resource.subjectRequests?.delete,
    !invalidCapabilityPaths.has(deletePath),
  );
  const fields = resource.fields
    .map((field) =>
      toDataMapField(
        field,
        exportCapability.status === "supported",
        deleteCapability.status === "supported",
      ),
    )
    .sort(compareDataMapFields);
  const retentionPolicies = resource.retentionPolicies
    .map(toDataRetentionPolicy)
    .sort(compareRetentionPolicies);
  const problems = dedupeProblems([
    ...normalizeProblemContracts(resource.problems),
    ...exportCapability.problems,
    ...deleteCapability.problems,
    ...(retentionPolicies.length > 0 ? [defaultRetentionViolationProblem()] : []),
  ]);
  const description = stringValue(resource.description);

  return {
    kind: stringValue(resource.kind) ?? "",
    label: stringValue(resource.label) ?? "",
    scope: (stringValue(resource.scope) ?? "") as DataMapResource["scope"],
    subject: toDataSubjectIdentity(resource.subject),
    classifications: collectClassifications(fields),
    fields,
    retentionPolicies,
    capabilities: {
      export: exportCapability,
      delete: deleteCapability,
    },
    problems,
    ...(description ? { description } : {}),
  };
}

function toDataMapField(
  field: UnknownRecord,
  exportSupported: boolean,
  deleteSupported: boolean,
): DataMapField {
  const classifications = asArray(field.classifications).filter(isDataClassificationTag);
  const label = stringValue(field.label);
  const valueType = stringValue(field.valueType);
  const retentionPolicyId = stringValue(field.retentionPolicyId);
  const source = stringValue(field.source);
  const description = stringValue(field.description);

  return {
    id: stringValue(field.id) ?? "",
    classifications: sortClassifications(classifications),
    exported: exportSupported && booleanFlagValue(field.exported),
    deleted: deleteSupported && booleanFlagValue(field.deleted),
    ...(label ? { label } : {}),
    ...(valueType ? { valueType: valueType as DataMapField["valueType"] } : {}),
    ...(retentionPolicyId ? { retentionPolicyId } : {}),
    ...(source ? { source } : {}),
    ...(description ? { description } : {}),
  };
}

function booleanFlagValue(value: unknown): boolean {
  return value === undefined || value === true;
}

function toDataSubjectIdentity(subject: UnknownRecord): DataMapResource["subject"] {
  const identity: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(subject)) {
    if (key === "type" || key === "idField") {
      identity[key] = stringValue(value) ?? "";
    } else if (key === "tenantField" || key === "labelField") {
      const field = stringValue(value);
      if (field !== undefined) {
        identity[key] = field;
      }
    } else if (key === "tenantIdentifierOverride" && isRecord(value)) {
      const reason = stringValue(value.reason);
      if (normalizeString(reason)) {
        identity.tenantIdentifierOverride = { reason };
      }
    }
  }

  identity.type ??= "";
  identity.idField ??= "";

  return identity as DataMapResource["subject"];
}

function toDataRetentionPolicy(policy: UnknownRecord): DataRetentionPolicy {
  const retentionPolicy: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(policy)) {
    if (key === "id") {
      retentionPolicy.id = stringValue(value) ?? "";
    } else if (key === "durationDays") {
      retentionPolicy.durationDays = isPositiveInteger(value) ? value : 0;
    } else if (key === "disposition") {
      retentionPolicy.disposition = isDataRetentionDisposition(value) ? value : "manual-review";
    } else if (key === "basis" || key === "startsFrom") {
      const field = stringValue(value);
      if (field !== undefined) {
        retentionPolicy[key] = field;
      }
    } else if (key === "legalHold" && (value === "block-delete" || value === "preserve")) {
      retentionPolicy.legalHold = value;
    } else if (key === "metadata" && isRecord(value)) {
      retentionPolicy.metadata = value;
    }
  }

  retentionPolicy.id ??= "";
  retentionPolicy.durationDays ??= 0;
  retentionPolicy.disposition ??= "manual-review";

  return retentionPolicy as DataRetentionPolicy;
}

function toDataMapCapability(
  name: "export" | "delete",
  capability: DataSubjectCapabilityCandidate | undefined,
  valid: boolean,
): DataMapCapability {
  if (!capability) {
    return {
      status: "not-supported",
      reason: "Capability is not declared",
      problems: [defaultUnsupportedCapabilityProblem(name)],
    };
  }

  const status = capability.status;
  const handlerId = normalizeString(capability.handlerId);
  const reason = normalizeString(capability.reason);
  const audit = isDataGovernanceAuditDescriptor(capability.audit) ? capability.audit : undefined;
  const problems = normalizeProblemContracts(capability.problems);

  if (status === "not-supported") {
    return {
      status: "not-supported",
      ...(reason ? { reason: stringValue(capability.reason) } : {}),
      ...(audit ? { audit } : {}),
      problems: dedupeProblems([defaultUnsupportedCapabilityProblem(name), ...problems]),
    };
  }

  if (status === "supported" && valid && handlerId && audit) {
    return {
      status: "supported",
      handlerId: stringValue(capability.handlerId),
      audit,
      problems: problems.sort(compareProblems),
    };
  }

  if (status === "supported") {
    return {
      status: "not-supported",
      reason: "Capability declaration is invalid",
      problems: dedupeProblems([defaultUnsupportedCapabilityProblem(name), ...problems]),
    };
  }

  return {
    status: "not-supported",
    reason:
      status === undefined || status === ""
        ? "Capability status is not declared"
        : "Capability status is invalid",
    problems: [defaultUnsupportedCapabilityProblem(name)],
  };
}

function collectInvalidCapabilityPaths(
  diagnostics: readonly DataGovernanceDiagnostic[],
): ReadonlySet<string> {
  const paths = new Set<string>();

  for (const diagnostic of diagnostics) {
    const match = /^(resources\[\d+\]\.subjectRequests\.(?:export|delete))(?:$|\.|\[)/.exec(
      diagnostic.path,
    );
    if (match?.[1]) {
      paths.add(match[1]);
    }
  }

  return paths;
}

function normalizeProblemContracts(problems: readonly UnknownRecord[]): DataMapProblemContract[] {
  return problems.flatMap((problem) => {
    const code = normalizeString(problem.code);
    if (!code) {
      return [];
    }

    const category = stringValue(problem.category);
    const title = stringValue(problem.title);
    const detail = stringValue(problem.detail);

    return [
      {
        code: stringValue(problem.code) ?? code,
        category: category ?? "InternalServerError",
        status: isFiniteNumber(problem.status) ? problem.status : 500,
        title: title ?? "Internal Server Error",
        ...(detail ? { detail } : {}),
        ...(typeof problem.retryable === "boolean" ? { retryable: problem.retryable } : {}),
        ...(isRecord(problem.metadata) ? { metadata: problem.metadata } : {}),
      },
    ];
  });
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

function readArray(
  value: unknown,
  path: string,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  required: boolean,
  resourceKind?: string,
  capability?: "export" | "delete",
): readonly unknown[] {
  if (Array.isArray(value)) {
    return Array.from(value);
  }

  if (value !== undefined || required) {
    diagnostics.push(
      createDiagnostic({
        capability,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.arrayShapeInvalid,
        message: `Data governance value at '${path}' must be an array`,
        path,
        resourceKind,
        target,
      }),
    );
  }

  return [];
}

function readObject(
  value: unknown,
  path: string,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  required: boolean,
  resourceKind?: string,
  capability?: "export" | "delete",
): UnknownRecord | undefined {
  if (isRecord(value)) {
    return value;
  }

  if (value !== undefined || required) {
    diagnostics.push(
      createDiagnostic({
        capability,
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.objectShapeInvalid,
        message: `Data governance value at '${path}' must be an object`,
        path,
        resourceKind,
        target,
      }),
    );
  }

  return undefined;
}

function readObjectArray(
  value: unknown,
  path: string,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  required: boolean,
  resourceKind?: string,
  capability?: "export" | "delete",
): readonly UnknownRecord[] {
  return readArray(value, path, target, diagnostics, required, resourceKind, capability).map(
    (entry, index) =>
      readObject(entry, `${path}[${index}]`, target, diagnostics, true, resourceKind, capability) ??
      {},
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isDataClassificationTag(value: unknown): value is DataClassificationTag {
  return typeof value === "string" && CLASSIFICATION_TAG_SET.has(value);
}

function isDataGovernanceAuditDescriptor(
  value: UnknownRecord | undefined,
): value is DataGovernanceAuditDescriptor {
  return Boolean(
    value &&
    normalizeString(value.eventName) &&
    normalizeString(value.subjectType) &&
    (value.actor === "required" || value.actor === "optional" || value.actor === "system") &&
    (value.reason === undefined || value.reason === "required" || value.reason === "optional") &&
    (value.idempotencyKey === undefined ||
      value.idempotencyKey === "required" ||
      value.idempotencyKey === "optional") &&
    (value.metadata === undefined || isRecord(value.metadata)),
  );
}

function isDataRetentionDisposition(value: unknown): value is DataRetentionPolicy["disposition"] {
  return (
    value === "delete" || value === "anonymize" || value === "archive" || value === "manual-review"
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateRequiredString(
  path: string,
  value: unknown,
  code: DataGovernanceDiagnosticCode,
  message: string,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: Pick<DataGovernanceDiagnostic, "capability" | "fieldId" | "resourceKind"> = {},
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

type DiagnosticContext = Pick<DataGovernanceDiagnostic, "capability" | "resourceKind">;

function validateRequiredValue(
  path: string,
  value: unknown,
  isValid: (candidate: unknown) => boolean,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  if (isValid(value)) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      ...context,
      code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.valueInvalid,
      message: `Data governance value at '${path}' has an invalid type or value`,
      path,
      target,
    }),
  );
}

function validateOptionalValue(
  path: string,
  value: unknown,
  isValid: (candidate: unknown) => boolean,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  if (value === undefined) {
    return;
  }

  validateRequiredValue(path, value, isValid, target, diagnostics, context);
}

function validateOptionalString(
  path: string,
  value: unknown,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  validateOptionalValue(
    path,
    value,
    (candidate) => typeof candidate === "string",
    target,
    diagnostics,
    context,
  );
}

function validateOptionalBoolean(
  path: string,
  value: unknown,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  validateOptionalValue(
    path,
    value,
    (candidate) => typeof candidate === "boolean",
    target,
    diagnostics,
    context,
  );
}

function validateOptionalNumber(
  path: string,
  value: unknown,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  validateOptionalValue(path, value, isFiniteNumber, target, diagnostics, context);
}

function validateOptionalRecord(
  path: string,
  value: unknown,
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  validateOptionalValue(path, value, isRecord, target, diagnostics, context);
}

function validateOptionalEnum(
  path: string,
  value: unknown,
  allowedValues: readonly unknown[],
  target: DataGovernanceDiagnosticTarget,
  diagnostics: DataGovernanceDiagnostic[],
  context: DiagnosticContext = {},
): void {
  validateOptionalValue(
    path,
    value,
    (candidate) => allowedValues.includes(candidate),
    target,
    diagnostics,
    context,
  );
}

function normalizeString(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : undefined;
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function asArray(value: unknown): readonly unknown[] {
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

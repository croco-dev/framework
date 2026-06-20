import { Problem, ProblemCategory } from "@croco/problems-core";

import type {
  AdminAction,
  AdminAuditDescriptor,
  AdminPermissionRequirement,
  AdminProblemContract,
  AdminResource,
  AdminResourceField,
  AdminResourceIdentity,
} from "./types";

export const ADMIN_CORE_DIAGNOSTIC_CODES = {
  resourceKindRequired: "admin-core/resource-kind-required",
  resourceLabelRequired: "admin-core/resource-label-required",
  resourceScopeRequired: "admin-core/resource-scope-required",
  resourceSourceRequired: "admin-core/resource-source-required",
  identityIdFieldRequired: "admin-core/identity-id-field-required",
  identityFieldUnknown: "admin-core/identity-field-unknown",
  fieldRequired: "admin-core/field-required",
  fieldIdRequired: "admin-core/field-id-required",
  fieldLabelRequired: "admin-core/field-label-required",
  fieldValueTypeRequired: "admin-core/field-value-type-required",
  fieldIdDuplicate: "admin-core/field-id-duplicate",
  listFieldRequired: "admin-core/list-field-required",
  listFieldUnknown: "admin-core/list-field-unknown",
  detailFieldRequired: "admin-core/detail-field-required",
  detailFieldUnknown: "admin-core/detail-field-unknown",
  actionIdRequired: "admin-core/action-id-required",
  actionLabelRequired: "admin-core/action-label-required",
  actionKindRequired: "admin-core/action-kind-required",
  actionTargetRequired: "admin-core/action-target-required",
  actionMutabilityRequired: "admin-core/action-mutability-required",
  actionIdDuplicate: "admin-core/action-id-duplicate",
  actionPermissionRequired: "admin-core/action-permission-required",
  actionAuditRequired: "admin-core/action-audit-required",
  actionProblemRequired: "admin-core/action-problem-required",
  problemCodeRequired: "admin-core/problem-code-required",
  problemCodeDuplicate: "admin-core/problem-code-duplicate",
} as const;

export type AdminResourceDiagnosticCode =
  (typeof ADMIN_CORE_DIAGNOSTIC_CODES)[keyof typeof ADMIN_CORE_DIAGNOSTIC_CODES];

export type AdminResourceDiagnosticTarget =
  | "resource"
  | "identity"
  | "field"
  | "list"
  | "detail"
  | "action"
  | "permission"
  | "audit"
  | "problem";

export type AdminResourceDiagnostic = {
  readonly code: AdminResourceDiagnosticCode;
  readonly severity: "error";
  readonly target: AdminResourceDiagnosticTarget;
  readonly message: string;
  readonly path: string;
  readonly resourceKind?: string;
  readonly fieldId?: string;
  readonly actionId?: string;
  readonly problemCode?: string;
};

export type AdminResourceValidationReport = {
  readonly resourceKind?: string;
  readonly valid: boolean;
  readonly diagnostics: readonly AdminResourceDiagnostic[];
};

export class AdminResourceValidationProblem extends Problem {
  readonly diagnostics: AdminResourceValidationReport["diagnostics"];

  constructor(report: AdminResourceValidationReport) {
    const resourceKind = report.resourceKind ?? "unknown";
    super(
      "admin-core/resource-validation-failed",
      ProblemCategory.ValidationError,
      `Admin resource '${resourceKind}' has ${report.diagnostics.length} invalid contract diagnostic(s)`,
      {
        extensions: {
          diagnostics: report.diagnostics,
          resourceKind,
        },
      },
    );
    this.diagnostics = report.diagnostics;
  }
}

export function defineAdminResource<const TResource extends AdminResource>(
  resource: TResource,
): TResource {
  return resource;
}

export function validateAdminResource(resource: AdminResource): AdminResourceValidationReport {
  const candidate = resource as Partial<AdminResource>;
  const resourceKind = normalizeString(candidate.kind);
  const diagnostics: AdminResourceDiagnostic[] = [];
  const fields = asArray(candidate.fields);
  const actions = asArray(candidate.actions);
  const fieldIds = collectFieldIds(fields, resourceKind, diagnostics);

  if (!resourceKind) {
    diagnostics.push(
      createDiagnostic({
        code: ADMIN_CORE_DIAGNOSTIC_CODES.resourceKindRequired,
        message: "Admin resource kind is required",
        path: "kind",
        target: "resource",
      }),
    );
  }
  validateRequiredString(
    "label",
    candidate.label,
    ADMIN_CORE_DIAGNOSTIC_CODES.resourceLabelRequired,
    "Admin resource label is required",
    "resource",
    resourceKind,
    diagnostics,
  );
  validateRequiredString(
    "scope",
    candidate.scope,
    ADMIN_CORE_DIAGNOSTIC_CODES.resourceScopeRequired,
    "Admin resource scope is required",
    "resource",
    resourceKind,
    diagnostics,
  );
  validateRequiredString(
    "source",
    candidate.source,
    ADMIN_CORE_DIAGNOSTIC_CODES.resourceSourceRequired,
    "Admin resource source is required",
    "resource",
    resourceKind,
    diagnostics,
  );

  validateIdentity(candidate.identity, fieldIds, resourceKind, diagnostics);
  validateList(candidate.list, fieldIds, resourceKind, diagnostics);
  validateDetail(candidate.detail, fieldIds, resourceKind, diagnostics);
  validateProblemContracts(candidate.problems, "problems", resourceKind, undefined, diagnostics);
  validateActions(actions, resourceKind, diagnostics);

  return {
    resourceKind,
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function assertAdminResourceValid<TResource extends AdminResource>(
  resource: TResource,
): TResource {
  const report = validateAdminResource(resource);

  if (!report.valid) {
    throw new AdminResourceValidationProblem(report);
  }

  return resource;
}

function collectFieldIds(
  fields: readonly AdminResourceField[],
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): ReadonlySet<string> {
  if (fields.length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: ADMIN_CORE_DIAGNOSTIC_CODES.fieldRequired,
        message: "Admin resource must declare at least one field",
        path: "fields",
        resourceKind,
        target: "field",
      }),
    );
    return new Set();
  }

  const fieldIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const [index, field] of fields.entries()) {
    const fieldId = normalizeString(field.id);
    if (!fieldId) {
      diagnostics.push(
        createDiagnostic({
          code: ADMIN_CORE_DIAGNOSTIC_CODES.fieldIdRequired,
          message: "Admin resource field id is required",
          path: `fields[${index}].id`,
          resourceKind,
          target: "field",
        }),
      );
      continue;
    }

    validateRequiredString(
      `fields[${index}].label`,
      field.label,
      ADMIN_CORE_DIAGNOSTIC_CODES.fieldLabelRequired,
      "Admin resource field label is required",
      "field",
      resourceKind,
      diagnostics,
      fieldId,
    );
    validateRequiredString(
      `fields[${index}].valueType`,
      field.valueType,
      ADMIN_CORE_DIAGNOSTIC_CODES.fieldValueTypeRequired,
      "Admin resource field valueType is required",
      "field",
      resourceKind,
      diagnostics,
      fieldId,
    );

    if (fieldIds.has(fieldId) && !duplicateIds.has(fieldId)) {
      duplicateIds.add(fieldId);
      diagnostics.push(
        createDiagnostic({
          code: ADMIN_CORE_DIAGNOSTIC_CODES.fieldIdDuplicate,
          fieldId,
          message: `Admin resource field '${fieldId}' is declared more than once`,
          path: `fields[${index}].id`,
          resourceKind,
          target: "field",
        }),
      );
    }

    fieldIds.add(fieldId);
  }

  return fieldIds;
}

function validateIdentity(
  identity: AdminResourceIdentity | undefined,
  fieldIds: ReadonlySet<string>,
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const idField = normalizeString(identity?.idField);
  if (!idField) {
    diagnostics.push(
      createDiagnostic({
        code: ADMIN_CORE_DIAGNOSTIC_CODES.identityIdFieldRequired,
        message: "Admin resource identity.idField is required",
        path: "identity.idField",
        resourceKind,
        target: "identity",
      }),
    );
    return;
  }

  validateKnownField("identity.idField", idField, fieldIds, resourceKind, diagnostics);
  validateKnownOptionalField(
    "identity.labelField",
    identity?.labelField,
    fieldIds,
    resourceKind,
    diagnostics,
  );
  validateKnownOptionalField(
    "identity.tenantField",
    identity?.tenantField,
    fieldIds,
    resourceKind,
    diagnostics,
  );
  validateKnownOptionalField(
    "identity.statusField",
    identity?.statusField,
    fieldIds,
    resourceKind,
    diagnostics,
  );
  validateKnownOptionalField(
    "identity.versionField",
    identity?.versionField,
    fieldIds,
    resourceKind,
    diagnostics,
  );
}

function validateList(
  list: AdminResource["list"] | undefined,
  fieldIds: ReadonlySet<string>,
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const listFields = asArray(list?.fields);
  if (listFields.length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: ADMIN_CORE_DIAGNOSTIC_CODES.listFieldRequired,
        message: "Admin resource list view must declare at least one field",
        path: "list.fields",
        resourceKind,
        target: "list",
      }),
    );
  }

  for (const [index, fieldId] of listFields.entries()) {
    validateKnownField(`list.fields[${index}]`, fieldId, fieldIds, resourceKind, diagnostics);
  }

  for (const [index, fieldId] of asArray(list?.filters).entries()) {
    validateKnownField(`list.filters[${index}]`, fieldId, fieldIds, resourceKind, diagnostics);
  }

  if (list?.defaultSort) {
    validateKnownField(
      "list.defaultSort.field",
      list.defaultSort.field,
      fieldIds,
      resourceKind,
      diagnostics,
    );
  }
}

function validateDetail(
  detail: AdminResource["detail"] | undefined,
  fieldIds: ReadonlySet<string>,
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const detailFields = asArray(detail?.fields);
  if (detailFields.length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: ADMIN_CORE_DIAGNOSTIC_CODES.detailFieldRequired,
        message: "Admin resource detail view must declare at least one field",
        path: "detail.fields",
        resourceKind,
        target: "detail",
      }),
    );
  }

  for (const [index, fieldId] of detailFields.entries()) {
    validateKnownField(`detail.fields[${index}]`, fieldId, fieldIds, resourceKind, diagnostics);
  }

  for (const [sectionIndex, section] of asArray(detail?.sections).entries()) {
    for (const [fieldIndex, fieldId] of asArray(section.fields).entries()) {
      validateKnownField(
        `detail.sections[${sectionIndex}].fields[${fieldIndex}]`,
        fieldId,
        fieldIds,
        resourceKind,
        diagnostics,
      );
    }
  }
}

function validateActions(
  actions: readonly AdminAction[],
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const actionIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const [index, action] of actions.entries()) {
    const actionId = normalizeString(action.id);
    const actionPath = `actions[${index}]`;
    if (!actionId) {
      diagnostics.push(
        createDiagnostic({
          code: ADMIN_CORE_DIAGNOSTIC_CODES.actionIdRequired,
          message: "Admin action id is required",
          path: `${actionPath}.id`,
          resourceKind,
          target: "action",
        }),
      );
    } else if (actionIds.has(actionId) && !duplicateIds.has(actionId)) {
      duplicateIds.add(actionId);
      diagnostics.push(
        createDiagnostic({
          actionId,
          code: ADMIN_CORE_DIAGNOSTIC_CODES.actionIdDuplicate,
          message: `Admin action '${actionId}' is declared more than once`,
          path: `${actionPath}.id`,
          resourceKind,
          target: "action",
        }),
      );
    }

    if (actionId) {
      actionIds.add(actionId);
    }

    validateRequiredString(
      `${actionPath}.label`,
      action.label,
      ADMIN_CORE_DIAGNOSTIC_CODES.actionLabelRequired,
      "Admin action label is required",
      "action",
      resourceKind,
      diagnostics,
      undefined,
      actionId,
    );
    validateRequiredString(
      `${actionPath}.kind`,
      action.kind,
      ADMIN_CORE_DIAGNOSTIC_CODES.actionKindRequired,
      "Admin action kind is required",
      "action",
      resourceKind,
      diagnostics,
      undefined,
      actionId,
    );
    validateRequiredString(
      `${actionPath}.target`,
      action.target,
      ADMIN_CORE_DIAGNOSTIC_CODES.actionTargetRequired,
      "Admin action target is required",
      "action",
      resourceKind,
      diagnostics,
      undefined,
      actionId,
    );
    validateRequiredString(
      `${actionPath}.mutability`,
      action.mutability,
      ADMIN_CORE_DIAGNOSTIC_CODES.actionMutabilityRequired,
      "Admin action mutability is required",
      "action",
      resourceKind,
      diagnostics,
      undefined,
      actionId,
    );
    validatePermissionRequirements(
      action.permissions,
      actionPath,
      resourceKind,
      actionId,
      diagnostics,
    );
    validateAudit(action.audit, actionPath, resourceKind, actionId, diagnostics);
    validateProblemContracts(
      action.problems,
      `${actionPath}.problems`,
      resourceKind,
      actionId,
      diagnostics,
    );
  }
}

function validatePermissionRequirements(
  permissions: readonly AdminPermissionRequirement[] | undefined,
  actionPath: string,
  resourceKind: string | undefined,
  actionId: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const requirements = asArray(permissions);
  if (requirements.length === 0) {
    diagnostics.push(
      createDiagnostic({
        actionId,
        code: ADMIN_CORE_DIAGNOSTIC_CODES.actionPermissionRequired,
        message: "Admin action must declare at least one permission requirement",
        path: `${actionPath}.permissions`,
        resourceKind,
        target: "permission",
      }),
    );
    return;
  }

  for (const [index, requirement] of requirements.entries()) {
    const permissionValues = asArray(requirement.permissions);
    if (
      permissionValues.length === 0 ||
      permissionValues.some((permission) => !normalizeString(permission))
    ) {
      diagnostics.push(
        createDiagnostic({
          actionId,
          code: ADMIN_CORE_DIAGNOSTIC_CODES.actionPermissionRequired,
          message: "Admin action permission requirement must include non-empty permission strings",
          path: `${actionPath}.permissions[${index}].permissions`,
          resourceKind,
          target: "permission",
        }),
      );
    }
  }
}

function validateAudit(
  audit: AdminAuditDescriptor | undefined,
  actionPath: string,
  resourceKind: string | undefined,
  actionId: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  if (!audit) {
    diagnostics.push(
      createDiagnostic({
        actionId,
        code: ADMIN_CORE_DIAGNOSTIC_CODES.actionAuditRequired,
        message: "Admin action must declare an audit descriptor",
        path: `${actionPath}.audit`,
        resourceKind,
        target: "audit",
      }),
    );
    return;
  }

  if (!normalizeString(audit.eventName) || !normalizeString(audit.subjectType)) {
    diagnostics.push(
      createDiagnostic({
        actionId,
        code: ADMIN_CORE_DIAGNOSTIC_CODES.actionAuditRequired,
        message: "Admin action audit descriptor must include eventName and subjectType",
        path: `${actionPath}.audit`,
        resourceKind,
        target: "audit",
      }),
    );
  }
}

function validateProblemContracts(
  problems: readonly AdminProblemContract[] | undefined,
  path: string,
  resourceKind: string | undefined,
  actionId: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const contracts = asArray(problems);
  if (path.includes(".problems") && contracts.length === 0) {
    diagnostics.push(
      createDiagnostic({
        actionId,
        code: ADMIN_CORE_DIAGNOSTIC_CODES.actionProblemRequired,
        message: "Admin action must declare at least one possible Problem outcome",
        path,
        resourceKind,
        target: "problem",
      }),
    );
    return;
  }

  const problemCodes = new Set<string>();
  const duplicateCodes = new Set<string>();

  for (const [index, problem] of contracts.entries()) {
    const problemCode = normalizeString(problem.code);
    if (!problemCode) {
      diagnostics.push(
        createDiagnostic({
          actionId,
          code: ADMIN_CORE_DIAGNOSTIC_CODES.problemCodeRequired,
          message: "Admin Problem contract code is required",
          path: `${path}[${index}].code`,
          resourceKind,
          target: "problem",
        }),
      );
      continue;
    }

    if (problemCodes.has(problemCode) && !duplicateCodes.has(problemCode)) {
      duplicateCodes.add(problemCode);
      diagnostics.push(
        createDiagnostic({
          actionId,
          code: ADMIN_CORE_DIAGNOSTIC_CODES.problemCodeDuplicate,
          message: `Admin Problem contract '${problemCode}' is declared more than once`,
          path: `${path}[${index}].code`,
          problemCode,
          resourceKind,
          target: "problem",
        }),
      );
    }

    problemCodes.add(problemCode);
  }
}

function validateKnownOptionalField(
  path: string,
  fieldId: string | undefined,
  fieldIds: ReadonlySet<string>,
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const normalizedFieldId = normalizeString(fieldId);
  if (!normalizedFieldId) {
    return;
  }

  validateKnownField(path, normalizedFieldId, fieldIds, resourceKind, diagnostics);
}

function validateKnownField(
  path: string,
  fieldId: string | undefined,
  fieldIds: ReadonlySet<string>,
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
): void {
  const normalizedFieldId = normalizeString(fieldId);
  if (!normalizedFieldId) {
    return;
  }

  if (!fieldIds.has(normalizedFieldId)) {
    const isIdentityPath = path.startsWith("identity.");
    diagnostics.push(
      createDiagnostic({
        code: isIdentityPath
          ? ADMIN_CORE_DIAGNOSTIC_CODES.identityFieldUnknown
          : path.startsWith("list.")
            ? ADMIN_CORE_DIAGNOSTIC_CODES.listFieldUnknown
            : ADMIN_CORE_DIAGNOSTIC_CODES.detailFieldUnknown,
        fieldId: normalizedFieldId,
        message: `Admin resource field reference '${normalizedFieldId}' is not declared in fields`,
        path,
        resourceKind,
        target: isIdentityPath ? "identity" : path.startsWith("list.") ? "list" : "detail",
      }),
    );
  }
}

function createDiagnostic(
  input: Omit<AdminResourceDiagnostic, "severity">,
): AdminResourceDiagnostic {
  return {
    ...input,
    severity: "error",
  };
}

function validateRequiredString(
  path: string,
  value: string | undefined,
  code: AdminResourceDiagnosticCode,
  message: string,
  target: AdminResourceDiagnosticTarget,
  resourceKind: string | undefined,
  diagnostics: AdminResourceDiagnostic[],
  fieldId?: string,
  actionId?: string,
): void {
  if (normalizeString(value)) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      actionId,
      code,
      fieldId,
      message,
      path,
      resourceKind,
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

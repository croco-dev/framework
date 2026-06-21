import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ADMIN_CORE_DIAGNOSTIC_CODES,
  AdminResourceValidationProblem,
  assertAdminResourceValid,
  defineAdminResource,
  validateAdminResource,
} from "../index";
import type {
  AdminAction,
  AdminAuditDescriptor,
  AdminPermissionRequirement,
  AdminProblemContract,
  AdminResource,
} from "../index";

const permission = (value: string): AdminPermissionRequirement => ({
  permissions: [value],
  scope: "admin",
});

const notFound = (code: string): AdminProblemContract => ({
  code,
  status: 404,
});

const audit = (
  eventName: string,
  subjectType: string,
  subjectIdField = "id",
): AdminAuditDescriptor => ({
  actor: "required",
  eventName,
  reason: "required",
  subjectIdField,
  subjectType,
});

const action = (input: {
  readonly id: string;
  readonly kind: AdminAction["kind"];
  readonly label: string;
  readonly permission: string;
  readonly problem: string;
  readonly subjectType: string;
}): AdminAction => ({
  audit: audit(`admin.${input.subjectType}.${input.id}`, input.subjectType),
  id: input.id,
  kind: input.kind,
  label: input.label,
  mutability: input.kind === "inspect" ? "read" : "write",
  permissions: [permission(input.permission)],
  problems: [notFound(input.problem)],
  target: "record",
});

const userResource = defineAdminResource({
  actions: [
    {
      audit: {
        actor: "required",
        eventName: "admin.user.list",
        subjectType: "user",
      },
      id: "list",
      kind: "list",
      label: "List users",
      mutability: "read",
      permissions: [permission("users:read")],
      problems: [{ code: "access/permission-denied", status: 403 }],
      target: "collection",
    },
    action({
      id: "disable",
      kind: "disable",
      label: "Disable user",
      permission: "users:disable",
      problem: "auth/user-not-found",
      subjectType: "user",
    }),
  ],
  detail: {
    fields: ["id", "tenantId", "email", "status"],
    sections: [{ fields: ["email", "status"], id: "account", label: "Account" }],
  },
  fields: [
    { id: "id", label: "ID", valueType: "string" },
    { id: "tenantId", label: "Tenant", valueType: "string" },
    { filterable: true, id: "email", label: "Email", valueType: "string" },
    { filterable: true, id: "status", label: "Status", valueType: "status" },
  ],
  identity: {
    idField: "id",
    labelField: "email",
    subjectType: "user",
    tenantField: "tenantId",
  },
  kind: "user",
  label: "User",
  list: {
    defaultSort: { direction: "asc", field: "email" },
    fields: ["email", "status"],
    filters: ["status"],
  },
  problems: [notFound("auth/user-not-found")],
  scope: "tenant",
  source: "croco",
});

const tenantResource = defineAdminResource({
  actions: [
    action({
      id: "inspect",
      kind: "inspect",
      label: "Inspect tenant",
      permission: "tenants:read",
      problem: "tenant-core/not-found",
      subjectType: "tenant",
    }),
    action({
      id: "disable",
      kind: "disable",
      label: "Disable tenant",
      permission: "tenants:disable",
      problem: "tenant-core/not-found",
      subjectType: "tenant",
    }),
  ],
  detail: {
    fields: ["id", "name", "status", "createdAt"],
  },
  fields: [
    { id: "id", label: "ID", valueType: "string" },
    { filterable: true, id: "name", label: "Name", valueType: "string" },
    { filterable: true, id: "status", label: "Status", valueType: "status" },
    { id: "createdAt", label: "Created", valueType: "datetime" },
  ],
  identity: {
    idField: "id",
    labelField: "name",
    statusField: "status",
    subjectType: "tenant",
  },
  kind: "tenant",
  label: "Tenant",
  list: {
    fields: ["name", "status"],
    filters: ["status"],
  },
  scope: "global",
  source: "croco",
});

const taskRunResource = defineAdminResource({
  actions: [
    {
      ...action({
        id: "retry",
        kind: "retry",
        label: "Retry task run",
        permission: "tasks:retry",
        problem: "tasks-core/task-not-found",
        subjectType: "task-run",
      }),
      idempotency: "required",
      recovery: {
        failureState: "failed",
        retryable: true,
        successState: "running",
      },
    },
  ],
  detail: {
    fields: ["id", "task", "status", "attempts", "problemCode"],
  },
  fields: [
    { id: "id", label: "ID", valueType: "string" },
    { filterable: true, id: "task", label: "Task", valueType: "string" },
    { filterable: true, id: "status", label: "Status", valueType: "status" },
    { id: "attempts", label: "Attempts", valueType: "number" },
    { id: "problemCode", label: "Problem", valueType: "problem" },
  ],
  identity: {
    idField: "id",
    labelField: "task",
    statusField: "status",
    subjectType: "task-run",
  },
  kind: "task-run",
  label: "Task run",
  list: {
    fields: ["task", "status", "attempts"],
    filters: ["task", "status"],
  },
  scope: "system",
  source: "croco",
});

const billingAccountResource = defineAdminResource({
  actions: [
    action({
      id: "edit-plan",
      kind: "edit",
      label: "Edit plan",
      permission: "billing:write",
      problem: "billing/subscription-not-found",
      subjectType: "billing-account",
    }),
  ],
  detail: {
    fields: ["id", "tenantId", "email", "planId", "providerStatus"],
  },
  fields: [
    { id: "id", label: "ID", valueType: "string" },
    { id: "tenantId", label: "Tenant", valueType: "string" },
    { filterable: true, id: "email", label: "Email", valueType: "string" },
    { filterable: true, id: "planId", label: "Plan", valueType: "string" },
    {
      filterable: true,
      id: "providerStatus",
      label: "Provider status",
      source: "provider",
      valueType: "status",
    },
  ],
  identity: {
    idField: "id",
    labelField: "email",
    subjectType: "billing-account",
    tenantField: "tenantId",
  },
  kind: "billing-account",
  label: "Billing account",
  list: {
    fields: ["email", "planId", "providerStatus"],
    filters: ["planId", "providerStatus"],
  },
  scope: "tenant",
  source: "croco",
});

describe("AdminResource", () => {
  it("models UI-agnostic resources, actions, permissions, audit descriptors, and Problems", () => {
    const resources = [userResource, tenantResource, taskRunResource, billingAccountResource];

    for (const resource of resources) {
      expect(validateAdminResource(resource)).toMatchObject({ valid: true, diagnostics: [] });
      expect(assertAdminResourceValid(resource)).toBe(resource);
    }

    expect(
      userResource.actions.find((candidate) => candidate.id === "disable")?.audit,
    ).toMatchObject({
      eventName: "admin.user.disable",
      reason: "required",
      subjectType: "user",
    });
    expect(userResource.actions.find((candidate) => candidate.id === "list")).toMatchObject({
      kind: "list",
      target: "collection",
    });
    expect(taskRunResource.actions[0]?.recovery).toEqual({
      failureState: "failed",
      retryable: true,
      successState: "running",
    });
    expect(billingAccountResource.fields.find((field) => field.id === "providerStatus")).toEqual(
      expect.objectContaining({ source: "provider" }),
    );
  });

  it("exposes the named public contract types required by admin packages", () => {
    expectTypeOf<typeof userResource>().toMatchTypeOf<AdminResource>();
    expectTypeOf<(typeof userResource.actions)[0]>().toMatchTypeOf<AdminAction | undefined>();
    expectTypeOf<(typeof userResource.actions)[0]["permissions"][0]>().toMatchTypeOf<
      AdminPermissionRequirement | undefined
    >();
    expectTypeOf<(typeof userResource.actions)[0]["audit"]>().toMatchTypeOf<
      AdminAuditDescriptor | undefined
    >();
    expectTypeOf<(typeof userResource.actions)[0]["problems"][0]>().toMatchTypeOf<
      AdminProblemContract | undefined
    >();
  });

  it("reports invalid resource definitions with stable diagnostic codes", () => {
    const invalidResource = {
      actions: [
        {
          audit: { actor: "required", eventName: "", subjectType: "" },
          id: "retry",
          kind: "",
          label: "",
          mutability: "",
          permissions: [{ permissions: [] }],
          problems: [],
          target: "",
        },
        {
          audit: audit("admin.task.retry", "task-run"),
          id: "retry",
          kind: "retry",
          label: "Retry duplicate",
          mutability: "write",
          permissions: [permission("tasks:retry")],
          problems: [{ code: "" }],
          target: "record",
        },
      ],
      detail: { fields: ["status", "missingDetail"] },
      fields: [
        { id: "id", label: "ID", valueType: "string" },
        { id: "id", label: "Duplicate ID", valueType: "string" },
        { id: "", label: "Blank", valueType: "string" },
        { id: "blankLabel", label: "", valueType: "" },
      ],
      identity: {
        idField: "missingId",
      },
      kind: "",
      label: "",
      list: {
        fields: ["id", "missingList"],
      },
      scope: "",
      source: "",
    } as unknown as AdminResource;

    const report = validateAdminResource(invalidResource);
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.valid).toBe(false);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.resourceKindRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.resourceLabelRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.resourceScopeRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.resourceSourceRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.identityFieldUnknown);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.fieldIdDuplicate);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.fieldIdRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.fieldLabelRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.fieldValueTypeRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.listFieldUnknown);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.detailFieldUnknown);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionIdDuplicate);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionLabelRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionKindRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionTargetRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionMutabilityRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionPermissionRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionAuditRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.actionProblemRequired);
    expect(codes).toContain(ADMIN_CORE_DIAGNOSTIC_CODES.problemCodeRequired);
  });

  it("throws a typed Problem that preserves all validation diagnostics", () => {
    const invalidResource = {
      actions: [],
      detail: { fields: [] },
      fields: [],
      identity: {},
      kind: "empty",
      label: "Empty",
      list: { fields: [] },
      scope: "tenant",
      source: "croco",
    } as unknown as AdminResource;

    expect(() => assertAdminResourceValid(invalidResource)).toThrow(AdminResourceValidationProblem);

    try {
      assertAdminResourceValid(invalidResource);
    } catch (error) {
      expect(error).toBeInstanceOf(AdminResourceValidationProblem);
      if (!(error instanceof AdminResourceValidationProblem)) {
        throw error;
      }

      expect(error.toJSON()).toMatchObject({
        code: "admin-core/resource-validation-failed",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: ADMIN_CORE_DIAGNOSTIC_CODES.identityIdFieldRequired,
          }),
        ]),
        resourceKind: "empty",
        status: 422,
      });
    }
  });
});

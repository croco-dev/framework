import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminForm } from "../libs/components";
import {
  createAdminFormState,
  createCoreProblemDetails,
  submitAdminForm,
  updateAdminFormField,
} from "../libs/snapshot";
import type {
  AdminFormContract,
  AdminFormFieldErrors,
  AdminFormState,
  AdminFormSubmitContext,
} from "../libs/types";

type UserFormValues = {
  readonly email: string;
  readonly displayName: string;
  readonly role: "owner" | "viewer";
  readonly notify: boolean;
};

type UserFormResult = {
  readonly id: string;
  readonly email: string;
};

const generatedAt = new Date("2026-06-20T00:00:00.000Z");

function createUserFormContract(
  overrides: Partial<AdminFormContract<UserFormValues, UserFormResult>> = {},
): AdminFormContract<UserFormValues, UserFormResult> {
  return {
    audit: {
      eventName: "admin.user.created",
      metadata: {
        resource: "users",
      },
      subjectId: "tenant-1",
      subjectType: "tenant",
    },
    fields: [
      {
        inputType: "email",
        label: "Email",
        name: "email",
        required: true,
        schemaPath: "UserCreateInput.email",
      },
      {
        inputType: "text",
        label: "Display name",
        name: "displayName",
        schemaPath: "UserCreateInput.displayName",
      },
      {
        inputType: "select",
        label: "Role",
        name: "role",
        options: [
          { label: "Owner", value: "owner" },
          { label: "Viewer", value: "viewer" },
        ],
        schemaPath: "UserCreateInput.role",
      },
      {
        inputType: "checkbox",
        label: "Send invite",
        name: "notify",
        schemaPath: "UserCreateInput.notify",
      },
    ],
    grantedPermissions: ["admin:user:write"],
    id: "admin.users.create",
    initialValues: {
      displayName: "",
      email: "",
      notify: true,
      role: "viewer",
    },
    intent: "create",
    recoveryActions: [
      {
        id: "retry-submit",
        kind: "retry",
        label: "Retry",
        problemCodes: ["admin/users-create-failed"],
      },
    ],
    requiredPermissions: ["admin:user:write"],
    submit: async ({ values }) => ({
      data: {
        email: values.email,
        id: "user-1",
      },
      kind: "success",
    }),
    successMessage: "User created",
    title: "Create user",
    ...overrides,
  };
}

function renderForm(state: AdminFormState<UserFormValues, UserFormResult>): string {
  return renderToStaticMarkup(createElement(AdminForm<UserFormValues, UserFormResult>, { state }));
}

describe("AdminForm", () => {
  it("renders and submits generated create-form fields with the backend input type", async () => {
    const submit = vi.fn(
      async ({ values }: AdminFormSubmitContext<UserFormValues, UserFormResult>) => ({
        audit: {
          eventName: "admin.user.created.committed",
          subjectId: "user-1",
          subjectType: "tenant" as const,
        },
        data: {
          email: values.email,
          id: "user-1",
        },
        kind: "success" as const,
      }),
    );
    const contract = createUserFormContract({ submit });
    const initialState = createAdminFormState(contract, { generatedAt });
    const dirtyState = updateAdminFormField(
      updateAdminFormField(initialState, "email", "ops@example.com"),
      "displayName",
      "Ops Admin",
    );

    const markup = renderForm(dirtyState);

    expect(markup).toContain('data-testid="admin-form"');
    expect(markup).toContain('data-schema-path="UserCreateInput.email"');
    expect(markup).toContain('data-schema-path="UserCreateInput.role"');
    expect(dirtyState.kind).toBe("dirty");

    const submittedState = await submitAdminForm(contract, dirtyState);

    expect(submittedState.kind).toBe("succeeded");
    expect(submittedState.submitResult).toEqual({
      email: "ops@example.com",
      id: "user-1",
    });
    expect(submittedState.lastSubmitAudit?.eventName).toBe("admin.user.created.committed");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: contract.audit,
        intent: "create",
        values: expect.objectContaining({
          displayName: "Ops Admin",
          email: "ops@example.com",
          role: "viewer",
        }),
      }),
    );
  });

  it("renders validation Problems at field level and keeps the global Problem slot empty", async () => {
    const validationProblem = createCoreProblemDetails({
      code: "validation/email-invalid",
      detail: "Email must be a valid address",
      source: "validation",
      status: 400,
      title: "Bad Request",
    });
    const fieldErrors = {
      email: [
        {
          code: "email.invalid",
          message: "Email must be a valid address",
          problem: validationProblem,
        },
      ],
    } satisfies AdminFormFieldErrors<UserFormValues>;
    const contract = createUserFormContract({
      submit: async () => ({
        audit: {
          eventName: "admin.user.validation_failed",
          subjectId: "tenant-1",
          subjectType: "tenant",
        },
        fieldErrors,
        kind: "validation_failed",
        problem: validationProblem,
        recoveryActions: [
          {
            id: "fix-email",
            kind: "custom",
            label: "Fix email",
            problemCodes: [validationProblem.code],
          },
        ],
      }),
    });
    const failedState = await submitAdminForm(
      contract,
      createAdminFormState(contract, { generatedAt }),
    );
    const markup = renderForm(failedState);

    expect(failedState.kind).toBe("failed");
    expect(failedState.problemKind).toBe("validation");
    expect(failedState.lastSubmitAudit?.eventName).toBe("admin.user.validation_failed");
    expect(markup).toContain('data-field-error-for="email"');
    expect(markup).toContain("Email must be a valid address");
    expect(markup).not.toContain('data-testid="admin-form-global-problem"');
    expect(markup).toContain('data-recovery-action-id="fix-email"');
  });

  it("renders domain Problems globally without turning them into field validation errors", async () => {
    const domainProblem = createCoreProblemDetails({
      code: "admin/user-already-exists",
      detail: "A user with this email already belongs to the tenant",
      source: "domain",
      status: 409,
      title: "Conflict",
    });
    const contract = createUserFormContract({
      submit: async () => ({
        kind: "domain_problem",
        problem: domainProblem,
      }),
    });
    const failedState = await submitAdminForm(
      contract,
      createAdminFormState(contract, { generatedAt }),
    );
    const markup = renderForm(failedState);

    expect(failedState.kind).toBe("failed");
    expect(failedState.problemKind).toBe("domain");
    expect(failedState.fieldErrors).toEqual({});
    expect(markup).toContain('data-testid="admin-form-global-problem"');
    expect(markup).toContain("admin/user-already-exists");
    expect(markup).not.toContain('data-field-error-for="email"');
  });

  it("blocks permission-denied submits before invoking the action handler", async () => {
    const submit = vi.fn(async () => ({
      data: {
        email: "ops@example.com",
        id: "user-1",
      },
      kind: "success" as const,
    }));
    const contract = createUserFormContract({
      grantedPermissions: ["admin:user:read"],
      recoveryActions: [
        {
          id: "request-access",
          kind: "navigate",
          label: "Request access",
          problemCodes: ["admin/permission-denied"],
        },
      ],
      submit,
    });
    const initialState = createAdminFormState(contract, { generatedAt });
    const editedState = updateAdminFormField(initialState, "email", "blocked@example.com");
    const submittedState = await submitAdminForm(contract, editedState);
    const markup = renderForm(editedState);

    expect(initialState.kind).toBe("failed");
    expect(initialState.problemKind).toBe("permission");
    expect(editedState.kind).toBe("failed");
    expect(editedState.problemKind).toBe("permission");
    expect(submittedState.problemKind).toBe("permission");
    expect(submit).not.toHaveBeenCalled();
    expect(markup).toContain('data-testid="admin-form-global-problem"');
    expect(markup).toContain("admin/permission-denied");
    expect(markup).toContain('data-recovery-action-id="request-access"');
    expect(markup).toContain('disabled=""');
  });

  it("distinguishes external failures and keeps retry recovery explicit", async () => {
    const contract = createUserFormContract({
      submit: async () => {
        throw new Error("Admin API gateway timed out");
      },
    });

    const failedState = await submitAdminForm(
      contract,
      createAdminFormState(contract, { generatedAt }),
    );
    const markup = renderForm(failedState);

    expect(failedState.kind).toBe("failed");
    expect(failedState.problemKind).toBe("external");
    expect(failedState.problem?.code).toBe("admin-form/external-failure");
    expect(markup).toContain("Admin API gateway timed out");
    expect(markup).toContain('data-recovery-action-id="retry-submit"');
  });

  it("allows custom visual field and action components to consume the same form state", () => {
    const state = createAdminFormState(createUserFormContract(), { generatedAt });
    const markup = renderToStaticMarkup(
      createElement(AdminForm<UserFormValues, UserFormResult>, {
        renderActions: ({ state: formState }) =>
          createElement("footer", { "data-testid": "custom-actions" }, formState.kind),
        renderField: ({ field }) =>
          createElement("section", { "data-custom-field": field.name }, field.label),
        state,
      }),
    );

    expect(markup).toContain('data-custom-field="email"');
    expect(markup).toContain('data-custom-field="role"');
    expect(markup).toContain('data-testid="custom-actions"');
  });

  it("uses the new contract values and audit when an old form state is submitted after a contract swap", async () => {
    const firstContract = createUserFormContract({
      id: "admin.users.create.first",
      initialValues: {
        displayName: "First",
        email: "first@example.com",
        notify: true,
        role: "viewer",
      },
    });
    const secondSubmit = vi.fn(
      async ({ audit, values }: AdminFormSubmitContext<UserFormValues, UserFormResult>) => ({
        audit,
        data: {
          email: values.email,
          id: "user-2",
        },
        kind: "success" as const,
      }),
    );
    const secondContract = createUserFormContract({
      audit: {
        eventName: "admin.user.second_created",
        subjectId: "tenant-2",
        subjectType: "tenant",
      },
      id: "admin.users.create.second",
      initialValues: {
        displayName: "Second",
        email: "second@example.com",
        notify: false,
        role: "owner",
      },
      submit: secondSubmit,
    });
    const staleState = createAdminFormState(firstContract, { generatedAt });

    const submittedState = await submitAdminForm(secondContract, staleState);

    expect(submittedState.contractId).toBe("admin.users.create.second");
    expect(submittedState.submitResult).toEqual({
      email: "second@example.com",
      id: "user-2",
    });
    expect(submittedState.lastSubmitAudit?.subjectId).toBe("tenant-2");
    expect(secondSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: secondContract.audit,
        previousState: expect.objectContaining({
          contractId: "admin.users.create.second",
        }),
        values: secondContract.initialValues,
      }),
    );
  });

  it("generates distinct default field ids when multiple forms share field names", () => {
    const state = createAdminFormState(createUserFormContract(), { generatedAt });
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(AdminForm<UserFormValues, UserFormResult>, { state }),
        createElement(AdminForm<UserFormValues, UserFormResult>, { state }),
      ),
    );
    const emailInputIds = [...markup.matchAll(/id="([^"]*field-email)"/g)].map((match) => match[1]);

    expect(emailInputIds).toHaveLength(2);
    expect(new Set(emailInputIds).size).toBe(2);
  });
});

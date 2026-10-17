import { Children, createElement, isValidElement } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Problem, ProblemCategory } from "@croco/problems-core";

import { ProblemClientError } from "../../../frontend-problems/src/index";

import { AdminForm, AdminFormField } from "../libs/components";
import {
  createAdminFormState,
  createCoreProblemDetails,
  submitAdminForm,
  updateAdminFormField,
} from "../libs/snapshot";
import type {
  AdminFormContract,
  AdminFormFieldErrors,
  AdminFormFieldContract,
  AdminFormFieldChangeHandler,
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

  it.each<AdminFormFieldErrors<UserFormValues>>([
    {},
    { displayName: [{ code: "name.invalid", message: "Invalid name" }] },
  ])(
    "renders the validation Problem when no configured field has an error: %j",
    async (fieldErrors) => {
      const problem = createCoreProblemDetails({
        code: "validation/invalid-range",
        detail: "End date must follow start date",
        source: "validation",
        status: 400,
        title: "Invalid date range",
      });
      const contract = createUserFormContract({
        fields: [{ name: "email", label: "Email", inputType: "email" }],
        submit: async () => ({ kind: "validation_failed", fieldErrors, problem }),
      });
      const state = await submitAdminForm(
        contract,
        createAdminFormState(contract, { generatedAt }),
      );
      const markup = renderForm(state);

      expect(state.kind).toBe("failed");
      expect(state.problemKind).toBe("validation");
      expect(state.problem).toBe(problem);
      expect(markup).toContain('data-testid="admin-form-global-problem"');
      expect(markup).toContain("Invalid date range");
      expect(markup).toContain("End date must follow start date");
    },
  );

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

  it.each(["client", "plain", "server"] as const)(
    "preserves the original %s Problem and its recovery extensions",
    async (kind) => {
      const problem = {
        type: "about:blank",
        code: "widget/name-taken",
        status: 409,
        title: "Widget name already used",
        detail: "Please choose another name",
        conflictingField: "name",
      };
      class NameTakenProblem extends Problem {
        constructor() {
          super(problem.code, ProblemCategory.Conflict, problem.detail, {
            extensions: { conflictingField: "name" },
          });
        }

        override get title(): string {
          return "Widget name already used";
        }
      }
      const error =
        kind === "client"
          ? new ProblemClientError(problem, new Response(null, { status: 409 }))
          : kind === "server"
            ? new NameTakenProblem()
            : problem;
      const contract = createUserFormContract({
        submit: async () => {
          throw error;
        },
      });

      const state = await submitAdminForm(contract, createAdminFormState(contract));

      expect(state.kind).toBe("failed");
      expect(state.problem).toEqual(problem);
      expect(state.recoveryActions).toEqual(contract.recoveryActions);
      expect(renderForm(state)).toContain("Widget name already used");
      expect(renderForm(state)).not.toContain("Bad Gateway");
    },
  );

  it.each([
    null,
    { code: "widget/name-taken", status: "409", title: "Invalid", type: "about:blank" },
  ])(
    "keeps malformed client Problem envelopes as explicit external failures (%s)",
    async (problem) => {
      const error = Object.assign(new Error("Unrecognized client failure"), { problem });
      const contract = createUserFormContract({
        submit: async () => {
          throw error;
        },
      });

      const state = await submitAdminForm(contract, createAdminFormState(contract));

      expect(state.problemKind).toBe("external");
      expect(state.problem).toMatchObject({
        code: "admin-form/external-failure",
        status: 502,
        title: "Bad Gateway",
        detail: "Unrecognized client failure",
        source: "external",
      });
    },
  );

  it("keeps a Problem serialization failure inside the form failure state", async () => {
    class UnserializableProblem extends Problem {
      constructor() {
        super("widget/invalid", ProblemCategory.Conflict, "Invalid Problem extensions");
      }

      override toJSON(): never {
        throw new Error("Serialization failed");
      }
    }
    const contract = createUserFormContract({
      submit: async () => {
        throw new UnserializableProblem();
      },
    });

    const state = await submitAdminForm(contract, createAdminFormState(contract));

    expect(state.kind).toBe("failed");
    expect(state.problem).toMatchObject({
      code: "admin-form/external-failure",
      status: 502,
      detail: "Invalid Problem extensions",
    });
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

  it.each([
    ["first.name", "first-name", "first_name", "first-name-errors"],
    ["이름", "주소", "--", ""],
    ["first_2e_name", "first.name", "first-name-description"],
  ])(
    "keeps label, description and error ids distinct for field names %j",
    (firstName, ...otherNames) => {
      const names = [firstName, ...otherNames];
      const field = (name: string, index: number) => ({
        name,
        label: `Field ${index}`,
        description: `Description ${index}`,
      });
      const contract: AdminFormContract<Record<string, string>> = {
        ...createUserFormContract(),
        fields: [field(firstName, 0), ...otherNames.map((name, index) => field(name, index + 1))],
        initialValues: Object.fromEntries(names.map((name, index) => [name, `Value ${index}`])),
        submit: async () => ({ kind: "success" }),
      };
      const state: AdminFormState<Record<string, string>> = {
        ...createAdminFormState(contract, { generatedAt }),
        fieldErrors: Object.fromEntries(
          names.map((name, index) => [
            name,
            [
              {
                code: `invalid.${index}`,
                message: `Error ${index}`,
              },
            ] as const,
          ]),
        ),
      };
      const markup = renderToStaticMarkup(
        createElement(AdminForm<Record<string, string>>, { state }),
      );
      const ids = [...markup.matchAll(/\bid="([^"]*)"/g)].map((match) => match[1]);
      const inputs = [...markup.matchAll(/<input\b[^>]*>/g)].map((match) => match[0]);
      const labels = [...markup.matchAll(/<label for="([^"]*)"/g)].map((match) => match[1]);
      const descriptions = [...markup.matchAll(/<p id="([^"]*)"/g)].map((match) => match[1]);
      const errors = [...markup.matchAll(/<ul data-field-error-for="[^"]*" id="([^"]*)"/g)].map(
        (match) => match[1],
      );

      expect(new Set(ids).size).toBe(ids.length);
      expect(inputs).toHaveLength(names.length);
      expect(labels).toHaveLength(names.length);
      expect(descriptions).toHaveLength(names.length);
      expect(errors).toHaveLength(names.length);
      inputs.forEach((input, index) => {
        expect(input.match(/\bid="([^"]*)"/)?.[1]).toBe(labels[index]);
        expect(input.match(/aria-describedby="([^"]*)"/)?.[1].split(" ")).toEqual([
          descriptions[index],
          errors[index],
        ]);
        expect(input).toContain('aria-invalid="true"');
      });
    },
  );

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

type NumberFormValues = { quantity: number | undefined };

function createNumberFormContract(required: boolean): AdminFormContract<NumberFormValues> {
  return {
    id: "quantity-form",
    title: "Edit quantity",
    intent: "update",
    fields: [{ name: "quantity", label: "Quantity", inputType: "number", required }],
    initialValues: { quantity: 42 },
    audit: { eventName: "quantity.updated", subjectType: "tenant", subjectId: "tenant-1" },
    submit: ({ values }) =>
      required && values.quantity === undefined
        ? {
            kind: "validation_failed",
            fieldErrors: {
              quantity: [{ code: "quantity.required", message: "Quantity is required" }],
            },
          }
        : { kind: "success" },
  };
}

function numberFieldInput(
  contract: AdminFormContract<NumberFormValues>,
  state: AdminFormState<NumberFormValues>,
  onFieldChange?: (name: "quantity", value: number | undefined) => void,
): ReactElement<{
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  required: boolean;
}> {
  const field = AdminFormField<NumberFormValues>({
    field: contract.fields[0],
    value: state.values.quantity,
    errors: state.fieldErrors.quantity ?? [],
    onFieldChange,
  });
  const input = Children.toArray((field.props as { children: ReactNode }).children).find(
    (child) => isValidElement(child) && child.type === "input",
  );
  if (!isValidElement(input)) throw new Error("Quantity input missing");
  return input as ReturnType<typeof numberFieldInput>;
}

describe("AdminForm numeric input", () => {
  it.each([false, true])(
    "preserves an empty number through state and submit (required=%s)",
    async (required) => {
      const contract = createNumberFormContract(required);
      let state = createAdminFormState(contract);
      numberFieldInput(contract, state, (name, value) => {
        state = updateAdminFormField(state, name, value);
      }).props.onChange({ currentTarget: { value: "" } } as ChangeEvent<HTMLInputElement>);

      expect(state.values.quantity).toBeUndefined();
      const input = numberFieldInput(contract, state);
      expect(input.props.value).toBe("");
      expect(input.props.required).toBe(required);
      state = await submitAdminForm(contract, state);
      expect(state.kind).toBe(required ? "failed" : "succeeded");
      if (required) {
        expect(state.fieldErrors.quantity).toEqual([
          { code: "quantity.required", message: "Quantity is required" },
        ]);
        const markup = renderToStaticMarkup(createElement(AdminForm<NumberFormValues>, { state }));
        expect(markup).toContain('aria-invalid="true"');
        expect(markup).toContain("Quantity is required");
      }
    },
  );

  it.each([
    ["0", 0],
    ["17", 17],
    ["-8", -8],
    ["3.25", 3.25],
  ])("converts explicit %s to numeric %s after clearing", (rawValue, expected) => {
    const contract = createNumberFormContract(false);
    let state = createAdminFormState(contract);
    const onFieldChange = (name: "quantity", value: number | undefined) => {
      state = updateAdminFormField(state, name, value);
    };
    numberFieldInput(contract, state, onFieldChange).props.onChange({
      currentTarget: { value: "" },
    } as ChangeEvent<HTMLInputElement>);
    numberFieldInput(contract, state, onFieldChange).props.onChange({
      currentTarget: { value: rawValue },
    } as ChangeEvent<HTMLInputElement>);
    expect(state.values.quantity).toBe(expected);
    expect(numberFieldInput(contract, state).props.value).toBe(rawValue);
  });
});

type DateFormValues = { start: Date | undefined; day: string };

function createDateFormContract(): AdminFormContract<DateFormValues> {
  return {
    id: "dates-form",
    title: "Edit dates",
    intent: "update",
    fields: [
      { name: "start", label: "Start", inputType: "date", dateValueType: "date", required: true },
      { name: "day", label: "Day", inputType: "date" },
    ],
    initialValues: { start: new Date("2026-10-02T23:45:00.000Z"), day: "2026-10-03" },
    audit: { eventName: "dates.updated", subjectType: "tenant", subjectId: "tenant-1" },
    submit: ({ values }) => ({ kind: "success", data: values }),
  };
}

function dateFieldInput(
  contract: AdminFormContract<DateFormValues>,
  state: AdminFormState<DateFormValues>,
  name: keyof DateFormValues,
  onFieldChange?: AdminFormFieldChangeHandler<DateFormValues>,
): ReactElement<{ onChange: (event: ChangeEvent<HTMLInputElement>) => void; value: string }> {
  const field = contract.fields.find((candidate) => candidate.name === name);
  if (!field) throw new Error("Date field missing");
  const element = AdminFormField<DateFormValues>({
    field,
    value: state.values[name],
    errors: [],
    onFieldChange,
  });
  const input = Children.toArray((element.props as { children: ReactNode }).children).find(
    (child) => isValidElement(child) && child.type === "input",
  );
  if (!isValidElement(input)) throw new Error("Date input missing");
  return input as ReturnType<typeof dateFieldInput>;
}

describe("AdminForm date inputs", () => {
  it("renders Date values using the UTC calendar date and preserves string dates", () => {
    const contract = createDateFormContract();
    const state = createAdminFormState(contract);
    expect(dateFieldInput(contract, state, "start").props.value).toBe("2026-10-02");
    expect(dateFieldInput(contract, state, "day").props.value).toBe("2026-10-03");
  });

  it("keeps the declared date representation through clear, re-entry and submit", async () => {
    const contract = createDateFormContract();
    let state = createAdminFormState(contract);
    const onFieldChange: AdminFormFieldChangeHandler<DateFormValues> = (name, value) => {
      state = updateAdminFormField(state, name, value);
    };
    const fill = (name: keyof DateFormValues, value: string) => {
      dateFieldInput(contract, state, name, onFieldChange).props.onChange({
        currentTarget: {
          value,
          valueAsDate: value === "" ? null : new Date(`${value}T00:00:00.000Z`),
        },
      } as ChangeEvent<HTMLInputElement>);
    };
    fill("start", "");
    fill("day", "");
    expect(state.values.start).toBeUndefined();
    expect(state.values.day).toBe("");
    expect(dateFieldInput(contract, state, "start").props.value).toBe("");
    fill("start", "2028-02-29");
    fill("day", "2027-07-15");
    expect(state.values.start).toBeInstanceOf(Date);
    expect(state.values.start?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(state.values.day).toBe("2027-07-15");
    const submitted = await submitAdminForm(contract, state);
    expect(submitted.submitResult).toEqual({
      start: new Date("2028-02-29T00:00:00.000Z"),
      day: "2027-07-15",
    });
  });

  it.each([
    ["0099-04-05T00:00:00.000Z", "0099-04-05"],
    ["+010000-06-07T00:00:00.000Z", "10000-06-07"],
  ])("renders %s as the HTML calendar date %s", (iso, expected) => {
    const contract = createDateFormContract();
    const state = updateAdminFormField(createAdminFormState(contract), "start", new Date(iso));
    expect(dateFieldInput(contract, state, "start").props.value).toBe(expected);
  });

  it("uses the declared Date representation even when the initial draft is empty", async () => {
    const contract = createDateFormContract();
    const emptyContract = {
      ...contract,
      initialValues: { ...contract.initialValues, start: undefined },
    };
    let state = createAdminFormState(emptyContract);
    dateFieldInput(emptyContract, state, "start", (name, value) => {
      state = updateAdminFormField(state, name, value);
    }).props.onChange({
      currentTarget: { value: "2026-11-12", valueAsDate: new Date("2026-11-12T00:00:00.000Z") },
    } as ChangeEvent<HTMLInputElement>);
    const submitted = await submitAdminForm(emptyContract, state);
    expect(submitted.values.start).toBeInstanceOf(Date);
    expect(submitted.values.start?.toISOString()).toBe("2026-11-12T00:00:00.000Z");
  });

  it("renders invalid Date draft values as empty instead of throwing", () => {
    const contract = createDateFormContract();
    const state = updateAdminFormField(createAdminFormState(contract), "start", new Date(NaN));
    expect(dateFieldInput(contract, state, "start").props.value).toBe("");
  });
});

it("requires an explicit Date representation and an empty draft type for date fields", () => {
  // @ts-expect-error Date fields must declare their date representation
  const ambiguous: AdminFormFieldContract<DateFormValues> = {
    name: "start",
    label: "Start",
    inputType: "date",
  };
  const nonemptyField = {
    name: "start",
    label: "Start",
    inputType: "date",
    dateValueType: "date",
  } as const;
  // @ts-expect-error Date inputs can be cleared, so their draft type must include undefined
  const nonempty: AdminFormFieldContract<{ start: Date }> = nonemptyField;
  // @ts-expect-error string fields cannot emit Date values
  const mismatched: AdminFormFieldContract<DateFormValues> = {
    name: "day",
    label: "Day",
    inputType: "date",
    dateValueType: "date",
  };
  expect([ambiguous.name, nonempty.name, mismatched.name]).toEqual(["start", "start", "day"]);
});

describe("AdminForm typed select", () => {
  type Values = { choice: string | number | null | undefined };
  const cases: { initial: Values["choice"]; values: Values["choice"][]; labels: string[] }[] = [
    { initial: "1", values: [1, "1", 2], labels: ["Number one", "Text one", "Two"] },
    { initial: "B", values: ["A", "B"], labels: ["Alpha", "Beta"] },
    { initial: "", values: ["", 0, "0"], labels: ["Choose", "Number zero", "Text zero"] },
    {
      initial: null,
      values: [null, "", undefined, "A"],
      labels: ["Choose", "Empty", "Undefined", "Alpha"],
    },
    { initial: undefined, values: [undefined, "A"], labels: ["Choose", "Alpha"] },
  ];

  it.each(cases)(
    "preserves initial selection, changes and submitted types for $initial",
    async ({ initial, values, labels }) => {
      const submit = vi.fn(({ values: submitted }: AdminFormSubmitContext<Values>) => ({
        kind: "success" as const,
        data: submitted.choice,
      }));
      const contract: AdminFormContract<Values> = {
        id: "typed-select",
        title: "Choose value",
        intent: "update",
        initialValues: { choice: initial },
        fields: [
          {
            name: "choice",
            label: "Choice",
            inputType: "select",
            required: true,
            options: values.map((value, index) => ({ value, label: labels[index] })),
          },
        ],
        audit: { eventName: "choice.updated", subjectType: "tenant", subjectId: "synthetic" },
        submit,
      };
      let state = createAdminFormState(contract);
      const renderSelect = () => {
        const field = AdminFormField<Values>({
          field: contract.fields[0],
          value: state.values.choice,
          errors: [],
          onFieldChange: (name, value) => {
            state = updateAdminFormField(state, name, value);
          },
        });
        const select = Children.toArray((field.props as { children: ReactNode }).children).find(
          (child) => isValidElement(child) && child.type === "select",
        );
        if (!isValidElement(select)) throw new Error("Choice select missing");
        return select as ReactElement<{
          value: string;
          onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
          children: ReactNode;
        }>;
      };
      const initialMarkup = renderToStaticMarkup(renderSelect());
      if (initial === "" || initial === null || initial === undefined)
        expect(initialMarkup).toContain('value="" selected=""');
      expect(
        [...initialMarkup.matchAll(/selected="">([^<]*)<\/option>/g)].map((match) => match[1]),
      ).toEqual([labels[values.indexOf(initial)]]);
      // Visit both colliding values repeatedly; read each identifier from its rendered option.
      for (const index of [...values.keys(), ...values.keys()].reverse()) {
        const select = renderSelect();
        const options = Children.toArray(select.props.children) as ReactElement<{
          value: string;
        }>[];
        expect(new Set(options.map((option) => option.props.value)).size).toBe(values.length);
        select.props.onChange({
          currentTarget: { value: options[index].props.value },
        } as ChangeEvent<HTMLSelectElement>);
        expect(state.values.choice).toBe(values[index]);
        expect(renderToStaticMarkup(renderSelect())).toContain(
          `selected="">${labels[index]}</option>`,
        );
        state = await submitAdminForm(contract, state);
        expect(submit).toHaveBeenLastCalledWith(
          expect.objectContaining({ values: { choice: values[index] } }),
        );
      }
    },
  );
});

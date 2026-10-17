import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminForm } from "../libs/hooks";
import type {
  AdminFormContract,
  AdminFormSubmitResult,
  AdminFormSubmitSuccess,
} from "../libs/types";

const reactHookHarness = vi.hoisted(() => ({
  hookIndex: 0,
  hookSlots: [] as unknown[],
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<Record<string, unknown>>();

  return {
    ...react,
    useCallback: <T>(callback: T): T => {
      reactHookHarness.hookIndex += 1;
      return callback;
    },
    useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]): void => {
      const hookIndex = reactHookHarness.hookIndex++;
      const previousDependencies = reactHookHarness.hookSlots[hookIndex] as
        | readonly unknown[]
        | undefined;
      const nextDependencies = dependencies ?? [];
      const dependenciesChanged =
        previousDependencies === undefined ||
        previousDependencies.length !== nextDependencies.length ||
        nextDependencies.some(
          (dependency, index) => !Object.is(dependency, previousDependencies[index]),
        );

      if (dependenciesChanged) {
        reactHookHarness.hookSlots[hookIndex] = nextDependencies;
        effect();
      }
    },
    useRef: <T>(initialValue: T): { current: T } => {
      const hookIndex = reactHookHarness.hookIndex++;

      if (!(hookIndex in reactHookHarness.hookSlots)) {
        reactHookHarness.hookSlots[hookIndex] = { current: initialValue };
      }

      return reactHookHarness.hookSlots[hookIndex] as { current: T };
    },
    useState: <T>(initialValue: T): readonly [T, (nextValue: T) => void] => {
      const hookIndex = reactHookHarness.hookIndex++;

      if (!(hookIndex in reactHookHarness.hookSlots)) {
        reactHookHarness.hookSlots[hookIndex] = initialValue;
      }

      return [
        reactHookHarness.hookSlots[hookIndex] as T,
        (nextValue: T) => {
          reactHookHarness.hookSlots[hookIndex] = nextValue;
        },
      ];
    },
  };
});

type UserFormValues = {
  readonly email: string;
};

type UserFormResult = {
  readonly id: string;
};

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => {
      if (!resolvePromise) {
        throw new Error("Deferred promise was not initialized");
      }

      resolvePromise(value);
    },
  };
}

function createUserFormContract(
  submit: AdminFormContract<UserFormValues, UserFormResult>["submit"],
): AdminFormContract<UserFormValues, UserFormResult> {
  return {
    audit: {
      eventName: "admin.user.updated",
      subjectId: "tenant-1",
      subjectType: "tenant",
    },
    fields: [
      {
        inputType: "email",
        label: "Email",
        name: "email",
        schemaPath: "UserUpdateInput.email",
      },
    ],
    grantedPermissions: ["admin:user:write"],
    id: "admin.users.update",
    initialValues: {
      email: "before@example.com",
    },
    intent: "update",
    requiredPermissions: ["admin:user:write"],
    submit,
    title: "Update user",
  };
}

function renderUserForm(
  contract: AdminFormContract<UserFormValues, UserFormResult>,
): ReturnType<typeof useAdminForm<UserFormValues, UserFormResult>> {
  reactHookHarness.hookIndex = 0;
  return useAdminForm(contract);
}

describe("useAdminForm", () => {
  beforeEach(() => {
    reactHookHarness.hookIndex = 0;
    reactHookHarness.hookSlots.length = 0;
  });

  it("refreshes field metadata without clearing edits and still resets replacement forms", () => {
    const original = createUserFormContract(async () => ({ kind: "success" }));
    const contract: typeof original = {
      ...original,
      fields: [{ name: "email", label: "Choice", inputType: "select", options: [] }],
    };
    const form = renderUserForm(contract);
    form.setFieldValue("email", "edited@example.com");
    const updated: typeof contract = {
      ...contract,
      fields: [
        {
          ...contract.fields[0],
          label: "Loaded choice",
          description: "Choose a loaded option",
          options: [
            { label: "Aster", value: "aster" },
            { label: "Birch", value: "birch", disabled: true },
          ],
        },
      ],
    };
    const refreshed = renderUserForm(updated);
    expect(refreshed.state.fields).toEqual(updated.fields);
    expect(refreshed.state).toMatchObject({
      values: { email: "edited@example.com" },
      dirtyFields: ["email"],
      kind: "dirty",
    });
    const replacement = { ...updated, id: "replacement" };
    renderUserForm(replacement);
    expect(renderUserForm(replacement).state).toMatchObject({
      contractId: "replacement",
      values: contract.initialValues,
      dirtyFields: [],
      kind: "idle",
    });
  });

  it("submits current metadata and lets an in-flight submit finish across metadata refreshes", async () => {
    const deferred = createDeferred<AdminFormSubmitSuccess<UserFormResult>>();
    const submit = vi.fn(() => deferred.promise);
    const contract = createUserFormContract(submit);
    renderUserForm(contract);
    const updated = {
      ...contract,
      fields: [{ ...contract.fields[0], label: "Updated email" }] as typeof contract.fields,
    };
    const form = renderUserForm(updated);
    const submission = form.submit();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        previousState: expect.objectContaining({ fields: updated.fields }),
      }),
    );
    const refreshed = {
      ...updated,
      fields: [{ ...updated.fields[0], description: "New hint" }] as typeof contract.fields,
    };
    expect(renderUserForm(refreshed).state.kind).toBe("submitting");
    deferred.resolve({ kind: "success", data: { id: "user-1" } });
    await submission;
    expect(renderUserForm(refreshed).state).toMatchObject({
      kind: "succeeded",
      submitResult: { id: "user-1" },
      fields: refreshed.fields,
    });
  });

  it("preserves a field edit made while a submit is in flight", async () => {
    const deferred = createDeferred<AdminFormSubmitResult<UserFormValues, UserFormResult>>();
    const submit = vi.fn(() => deferred.promise);
    const form = renderUserForm(createUserFormContract(submit));

    const submission = form.submit();

    form.setFieldValue("email", "edited@example.com");
    deferred.resolve({
      data: { id: "user-1" },
      kind: "success",
    });

    await expect(submission).resolves.toMatchObject({
      dirtyFields: ["email"],
      kind: "dirty",
      values: { email: "edited@example.com" },
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ values: { email: "before@example.com" } }),
    );
  });

  it("ignores a re-entrant submit while a submission is in flight", async () => {
    const deferred = createDeferred<AdminFormSubmitSuccess<UserFormResult>>();
    const submit = vi.fn(() => deferred.promise);
    const form = renderUserForm(createUserFormContract(submit));

    const firstSubmission = form.submit();
    form.setFieldValue("email", "edited@example.com");
    const secondSubmission = form.submit();

    expect(submit).toHaveBeenCalledTimes(1);
    await expect(secondSubmission).resolves.toMatchObject({
      kind: "dirty",
      values: { email: "edited@example.com" },
    });

    deferred.resolve({
      data: { id: "user-1" },
      kind: "success",
    });
    await expect(firstSubmission).resolves.toMatchObject({
      kind: "dirty",
      values: { email: "edited@example.com" },
    });
  });

  it("allows a replacement form to submit while the previous form is still in flight", async () => {
    const firstDeferred = createDeferred<AdminFormSubmitSuccess<UserFormResult>>();
    const secondDeferred = createDeferred<AdminFormSubmitSuccess<UserFormResult>>();
    const firstSubmit = vi.fn(() => firstDeferred.promise);
    const secondSubmit = vi.fn(() => secondDeferred.promise);
    const firstForm = renderUserForm(createUserFormContract(firstSubmit));

    const firstSubmission = firstForm.submit();
    const secondContract: AdminFormContract<UserFormValues, UserFormResult> = {
      ...createUserFormContract(secondSubmit),
      id: "admin.users.create",
      initialValues: { email: "new@example.com" },
      title: "Create user",
    };
    const secondForm = renderUserForm(secondContract);
    const secondSubmission = secondForm.submit();

    expect(firstSubmit).toHaveBeenCalledTimes(1);
    expect(secondSubmit).toHaveBeenCalledTimes(1);
    expect(secondSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ values: { email: "new@example.com" } }),
    );

    firstDeferred.resolve({
      data: { id: "old-user" },
      kind: "success",
    });
    await firstSubmission;

    const reentrantSubmission = secondForm.submit();

    expect(secondSubmit).toHaveBeenCalledTimes(1);
    await expect(reentrantSubmission).resolves.toMatchObject({
      kind: "submitting",
      values: { email: "new@example.com" },
    });

    secondDeferred.resolve({
      data: { id: "new-user" },
      kind: "success",
    });
    await expect(secondSubmission).resolves.toMatchObject({
      kind: "succeeded",
      submitResult: { id: "new-user" },
      values: { email: "new@example.com" },
    });
  });
});

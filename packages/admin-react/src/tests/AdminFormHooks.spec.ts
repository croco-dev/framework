import { describe, expect, it, vi } from "vitest";

import { useAdminForm } from "../libs/hooks";
import type {
  AdminFormContract,
  AdminFormSubmitResult,
  AdminFormSubmitSuccess,
} from "../libs/types";

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<Record<string, unknown>>();

  return {
    ...react,
    useCallback: <T>(callback: T): T => callback,
    useEffect: (effect: () => void | (() => void)): void => {
      effect();
    },
    useRef: <T>(initialValue: T): { current: T } => ({ current: initialValue }),
    useState: <T>(initialValue: T): readonly [T, () => void] => [initialValue, () => undefined],
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

describe("useAdminForm", () => {
  it("preserves a field edit made while a submit is in flight", async () => {
    const deferred = createDeferred<AdminFormSubmitResult<UserFormValues, UserFormResult>>();
    const submit = vi.fn(() => deferred.promise);
    const form = useAdminForm(createUserFormContract(submit));

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
    const form = useAdminForm(createUserFormContract(submit));

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
});

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createAdminFormState,
  resetAdminFormState,
  startAdminFormSubmit,
  submitAdminForm,
  updateAdminFormField,
} from "./snapshot";
import type {
  AdminFormContract,
  AdminFormController,
  AdminFormFieldChangeHandler,
  AdminFormState,
  AdminFormStateOptions,
} from "./types";

export function useAdminForm<TValues extends object, TResult = unknown>(
  contract: AdminFormContract<TValues, TResult>,
  options: AdminFormStateOptions = {},
): AdminFormController<TValues, TResult> {
  const initialState = createAdminFormState(contract, options);
  const [state, setState] = useState(initialState);
  const stateRef = useRef<AdminFormState<TValues, TResult>>(initialState);
  const submitInFlightGenerationRef = useRef<number | undefined>(undefined);
  const formGenerationRef = useRef(0);
  const optionsGeneratedAtTime = options.generatedAt?.getTime();
  const optionsGrantedPermissionsKey = options.grantedPermissions?.join("\u0000") ?? "";
  const stateResetKey = createAdminFormStateResetKey(
    contract,
    optionsGeneratedAtTime,
    optionsGrantedPermissionsKey,
  );
  const stateResetKeyRef = useRef(stateResetKey);

  const setAdminFormState = useCallback(
    (
      updater:
        | AdminFormState<TValues, TResult>
        | ((current: AdminFormState<TValues, TResult>) => AdminFormState<TValues, TResult>),
    ) => {
      const nextState = typeof updater === "function" ? updater(stateRef.current) : updater;

      stateRef.current = nextState;
      setState(nextState);
    },
    [],
  );

  const setFieldValue = useCallback(
    (<TName extends Extract<keyof TValues, string>>(name: TName, value: TValues[TName]) => {
      setAdminFormState((current) => updateAdminFormField(current, name, value));
    }) as AdminFormFieldChangeHandler<TValues>,
    [setAdminFormState],
  );

  useEffect(() => {
    if (stateResetKeyRef.current === stateResetKey) {
      return;
    }

    const nextState = createAdminFormState(contract, options);

    stateResetKeyRef.current = stateResetKey;
    formGenerationRef.current += 1;
    stateRef.current = nextState;
    setState(nextState);
  }, [contract, options, stateResetKey]);

  const reset = useCallback(() => {
    const nextState = resetAdminFormState(contract, options);

    formGenerationRef.current += 1;
    stateRef.current = nextState;
    setAdminFormState(nextState);
  }, [contract, options, setAdminFormState]);

  const runSubmit = useCallback(
    async (retry?: boolean) => {
      const formGeneration = formGenerationRef.current;

      if (submitInFlightGenerationRef.current === formGeneration) {
        return stateRef.current;
      }

      submitInFlightGenerationRef.current = formGeneration;
      const currentState = stateRef.current;
      const shouldRetry = retry ?? currentState.kind === "failed";
      const submittingState = startAdminFormSubmit(currentState, { retry: shouldRetry });

      setAdminFormState(submittingState);

      try {
        const nextState = await submitAdminForm(contract, currentState, { retry: shouldRetry });

        if (formGenerationRef.current !== formGeneration || stateRef.current !== submittingState) {
          return stateRef.current;
        }

        setAdminFormState(nextState);

        return nextState;
      } finally {
        if (submitInFlightGenerationRef.current === formGeneration) {
          submitInFlightGenerationRef.current = undefined;
        }
      }
    },
    [contract, setAdminFormState],
  );

  const submit = useCallback(() => runSubmit(), [runSubmit]);

  const retry = useCallback(() => runSubmit(true), [runSubmit]);

  return {
    contract,
    reset,
    retry,
    setFieldValue,
    state,
    submit,
  };
}

function createAdminFormStateResetKey<TValues extends object, TResult>(
  contract: AdminFormContract<TValues, TResult>,
  optionsGeneratedAtTime: number | undefined,
  optionsGrantedPermissionsKey: string,
): string {
  return stringifyAdminFormStateResetValue({
    audit: contract.audit,
    contractId: contract.id,
    fields: contract.fields.map((field) => ({
      inputType: field.inputType,
      name: field.name,
      required: field.required,
      schemaPath: field.schemaPath,
    })),
    generatedAt: optionsGeneratedAtTime,
    grantedPermissions: optionsGrantedPermissionsKey,
    initialValues: contract.initialValues,
    intent: contract.intent,
    requiredPermissions: contract.requiredPermissions ?? [],
    title: contract.title,
  });
}

function stringifyAdminFormStateResetValue(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, nestedValue: unknown) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
    );
  } catch {
    return String(value);
  }
}

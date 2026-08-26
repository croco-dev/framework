import type { TaskReference } from "./types";

type TaskMethodName<TTarget extends object> = Extract<
  {
    [TKey in keyof TTarget]-?: TTarget[TKey] extends (...args: never[]) => unknown ? TKey : never;
  }[keyof TTarget],
  string
>;

type TaskMethodPayload<TMethod> = TMethod extends (
  payload: infer TPayload,
  ...args: never[]
) => unknown
  ? TPayload
  : unknown;

type TaskMethodResult<TMethod> = TMethod extends (...args: never[]) => infer TResult
  ? Awaited<TResult>
  : never;

type TaskTarget<TTarget extends object> = object & {
  readonly prototype: TTarget;
};

/**
 * Creates a runtime task reference whose payload and result types are inferred from the handler.
 */
export function taskRef<
  TTarget extends object,
  TMethodName extends TaskMethodName<TTarget>,
  const TName extends string,
>(
  target: TaskTarget<TTarget>,
  methodName: TMethodName,
  name: TName,
): TaskReference<
  TaskMethodPayload<TTarget[TMethodName]>,
  TaskMethodResult<TTarget[TMethodName]>,
  TName
> {
  return {
    name,
    target,
    methodName,
  };
}

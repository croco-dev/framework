import { MetadataStorage } from "@croco/framework-context";
import { TASK_METADATA_KEY } from "./decorators/Task";
import { InvalidTaskReferenceProblem } from "./problems/TasksProblems";
import type { TaskExecutionContext, TaskMetadata, TaskReference } from "./types";

type TaskHandlerMethod = (...args: never[]) => unknown;
type SupportedTaskHandler<THandler extends TaskHandlerMethod> = THandler extends (
  payload: TaskMethodPayload<THandler>,
  context: TaskExecutionContext,
) => unknown
  ? THandler
  : never;
type TaskMethodName<TTarget extends object> = Extract<
  {
    [TKey in keyof TTarget]-?: TTarget[TKey] extends TaskHandlerMethod
      ? SupportedTaskHandler<TTarget[TKey]> extends never
        ? never
        : TKey
      : never;
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
  readonly name: string;
  readonly prototype: TTarget;
};

const taskReferences = new WeakSet<object>();

export function isFactoryTaskReference(reference: object): boolean {
  return taskReferences.has(reference);
}

function createTaskReference<TPayload, TResult, TName extends string>(
  target: object,
  methodName: string,
  name: TName,
): TaskReference<TPayload, TResult, TName> {
  const reference = Object.freeze({ name, target, methodName });
  taskReferences.add(reference);
  return reference;
}

/**
 * Creates a runtime task reference whose payload and result types are inferred from the handler.
 */
export function taskRef<TTarget extends object, TMethodName extends TaskMethodName<TTarget>>(
  target: TaskTarget<TTarget>,
  methodName: TMethodName,
): TaskReference<TaskMethodPayload<TTarget[TMethodName]>, TaskMethodResult<TTarget[TMethodName]>>;
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
>;
export function taskRef<TTarget extends object, TMethodName extends TaskMethodName<TTarget>>(
  target: TaskTarget<TTarget>,
  methodName: TMethodName,
  name?: string,
): TaskReference<TaskMethodPayload<TTarget[TMethodName]>, TaskMethodResult<TTarget[TMethodName]>> {
  if (name !== undefined) {
    return createTaskReference(target, methodName, name);
  }

  const metadata = MetadataStorage.get<TaskMetadata>(TASK_METADATA_KEY, target, methodName);
  const referenceName = `${target.name}.${String(methodName)}`;
  if (metadata === undefined || metadata.target !== target || metadata.methodName !== methodName) {
    throw new InvalidTaskReferenceProblem(
      referenceName,
      "The handler method does not have matching @Task metadata",
    );
  }

  return createTaskReference(target, methodName, metadata.name);
}

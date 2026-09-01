import type { ExecutionManager } from "@croco/execution-core";
import { Container, MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { TASK_METADATA_KEY, Task } from "../libs/decorators/Task";
import { InvalidTaskReferenceProblem } from "../libs/problems/TasksProblems";
import { taskRef } from "../libs/taskRef";
import { TaskRegistry } from "../libs/TaskRegistry";
import { TaskRunner } from "../libs/TaskRunner";
import type {
  TaskExecutionContext,
  TaskMetadata,
  TaskReference,
  TaskReferencePayload,
  TaskReferenceResult,
} from "../libs/types";

describe("taskRef", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("derives the runtime name and handler contract from task metadata", () => {
    class TypedTaskHandler {
      @Task({ name: "typed-task" })
      async execute(payload: { value: number }): Promise<{ doubled: number }> {
        return { doubled: payload.value * 2 };
      }
    }

    const reference = taskRef(TypedTaskHandler, "execute");

    expect(reference).toEqual({
      name: "typed-task",
      target: TypedTaskHandler,
      methodName: "execute",
    });
    expect(Object.isFrozen(reference)).toBe(true);
    expect(Reflect.set(reference, "name", "other-task")).toBe(false);
    expectTypeOf<TaskReferencePayload<typeof reference>>().toEqualTypeOf<{ value: number }>();
    expectTypeOf<TaskReferenceResult<typeof reference>>().toEqualTypeOf<{ doubled: number }>();
  });

  it("preserves the explicit-name overload used by workflow definitions", () => {
    class WorkflowTask {
      execute(payload: { value: number }): { doubled: number } {
        return { doubled: payload.value * 2 };
      }
    }

    const reference = taskRef(WorkflowTask, "execute", "workflow.typed-task");

    expect(reference.name).toBe("workflow.typed-task");
    expectTypeOf(reference.name).toEqualTypeOf<"workflow.typed-task">();
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it("makes TaskRunner infer payload and awaited result types", () => {
    class TypedTaskHandler {
      @Task({ name: "typed-task" })
      async execute(payload: { value: number }): Promise<{ doubled: number }> {
        return { doubled: payload.value * 2 };
      }
    }

    const reference = taskRef(TypedTaskHandler, "execute");
    const execute = (runner: TaskRunner) => runner.execute(reference, { value: 2 });
    const rejectInvalidPayload = (runner: TaskRunner) =>
      // @ts-expect-error typed task references reject incompatible payloads
      runner.execute(reference, { value: "2" });

    class StringTaskHandler {
      execute(payload: { value: string }): string {
        return payload.value;
      }
    }

    const stringReference = taskRef(StringTaskHandler, "execute", "string-task");
    const rejectUnionReferencePayload = (
      runner: TaskRunner,
      unionReference: typeof reference | typeof stringReference,
    ) =>
      // @ts-expect-error union references cannot preserve the reference and payload correlation
      runner.execute(unionReference, { value: 2 });

    expectTypeOf(execute).returns.toEqualTypeOf<Promise<{ doubled: number }>>();
    expectTypeOf(rejectInvalidPayload).returns.toEqualTypeOf<Promise<{ doubled: number }>>();
    expect(rejectUnionReferencePayload).toBeTypeOf("function");
    expectTypeOf<
      TaskReferencePayload<TaskReference<never, { doubled: number }>>
    >().toEqualTypeOf<never>();
    expectTypeOf<TaskReferenceResult<TaskReference<never, { doubled: number }>>>().toEqualTypeOf<{
      doubled: number;
    }>();
  });

  it("rejects handler signatures that TaskRunner cannot invoke", () => {
    class InvalidContextHandler {
      @Task({ name: "invalid-context" })
      execute(payload: { value: number }, context: string): number {
        return payload.value + context.length;
      }
    }

    class ExtraArgumentHandler {
      @Task({ name: "extra-argument" })
      execute(payload: { value: number }, context: TaskExecutionContext, extra: number): number {
        return payload.value + context.attempt + extra;
      }
    }

    const rejectInvalidContext = () =>
      // @ts-expect-error TaskRunner supplies TaskExecutionContext as the second argument
      taskRef(InvalidContextHandler, "execute");
    const rejectExtraArgument = () =>
      // @ts-expect-error TaskRunner supplies exactly payload and TaskExecutionContext
      taskRef(ExtraArgumentHandler, "execute");

    expect(rejectInvalidContext).toBeTypeOf("function");
    expect(rejectExtraArgument).toBeTypeOf("function");
  });

  it("rejects methods without task metadata when the name is omitted", () => {
    class UndecoratedHandler {
      execute(payload: { value: number }): number {
        return payload.value;
      }
    }

    expect(() => taskRef(UndecoratedHandler, "execute")).toThrow(InvalidTaskReferenceProblem);
  });

  it("rejects a reference when its metadata name drifts from the registry", async () => {
    class RenamedTaskHandler {
      @Task({ name: "original-task" })
      execute(payload: { value: number }): number {
        return payload.value;
      }
    }

    const reference = taskRef(RenamedTaskHandler, "execute");
    const metadata = MetadataStorage.get<TaskMetadata>(
      TASK_METADATA_KEY,
      RenamedTaskHandler,
      "execute",
    );
    expect(metadata).toBeDefined();
    if (metadata === undefined) return;

    const registry = new TaskRegistry();
    registry.register(reference.name, RenamedTaskHandler, "execute", {
      ...metadata,
      name: "renamed-task",
      options: { ...metadata.options, name: "renamed-task" },
    });
    const runner = new TaskRunner(undefined as unknown as ExecutionManager, registry);

    await expect(runner.execute(reference, { value: 1 })).rejects.toBeInstanceOf(
      InvalidTaskReferenceProblem,
    );
  });

  it("rejects registry metadata target or method drift before execution creation", async () => {
    class RegistryTaskHandler {
      @Task({ name: "registry-task" })
      execute(payload: { value: number }): number {
        return payload.value;
      }
    }

    class OtherTaskHandler {}

    const reference = taskRef(RegistryTaskHandler, "execute");
    const metadata = MetadataStorage.get<TaskMetadata>(
      TASK_METADATA_KEY,
      RegistryTaskHandler,
      "execute",
    );
    expect(metadata).toBeDefined();
    if (metadata === undefined) return;

    const driftedMetadata = [
      { ...metadata, target: OtherTaskHandler },
      { ...metadata, methodName: "otherMethod" },
    ];

    for (const drift of driftedMetadata) {
      const create = vi.fn();
      const registry = new TaskRegistry();
      registry.register(reference.name, RegistryTaskHandler, "execute", drift);
      const runner = new TaskRunner({ create } as unknown as ExecutionManager, registry);

      await expect(runner.execute(reference, { value: 1 })).rejects.toBeInstanceOf(
        InvalidTaskReferenceProblem,
      );
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("rejects factory references missing from the registry before execution creation", async () => {
    class UnregisteredTaskHandler {
      @Task({ name: "unregistered-task" })
      execute(payload: { value: number }): number {
        return payload.value;
      }
    }

    const create = vi.fn();
    const reference = taskRef(UnregisteredTaskHandler, "execute");
    const runner = new TaskRunner({ create } as unknown as ExecutionManager, new TaskRegistry());

    await expect(runner.execute(reference, { value: 1 })).rejects.toBeInstanceOf(
      InvalidTaskReferenceProblem,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects copied or independently constructed references", async () => {
    class TypedTaskHandler {
      @Task({ name: "typed-task" })
      execute(payload: { value: number }): number {
        return payload.value;
      }
    }

    const reference = taskRef(TypedTaskHandler, "execute");
    const copiedReference: TaskReference<{ value: number }, number> = { ...reference };
    const runner = new TaskRunner(
      undefined as unknown as ExecutionManager,
      TaskRegistry.fromMetadata(),
    );

    await expect(runner.execute(copiedReference, { value: 1 })).rejects.toBeInstanceOf(
      InvalidTaskReferenceProblem,
    );
  });

  it.each([null, 42])(
    "rejects invalid runtime references without dereferencing %j",
    async (value) => {
      const runner = new TaskRunner(
        undefined as unknown as ExecutionManager,
        TaskRegistry.fromMetadata(),
      );

      await expect(runner.execute(value as unknown as TaskReference, { value: 1 })).rejects.toThrow(
        "Invalid task reference '<unknown>': The task reference was not created by taskRef",
      );
    },
  );
});

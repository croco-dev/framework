import { MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { Task } from "../libs/decorators/Task";
import { DuplicateTaskRegistrationProblem } from "../libs/problems/TasksProblems";
import { TaskRegistry } from "../libs/TaskRegistry";
import type { TaskMetadata } from "../libs/types";

describe("TaskRegistry", () => {
  beforeEach(() => {
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();
  });

  it("should be a singleton", () => {
    const instance1 = TaskRegistry.getInstance();
    const instance2 = TaskRegistry.getInstance();

    expect(instance1).toBe(instance2);
  });

  it("should register task manually", () => {
    class TestTaskHandler {
      async handle(_payload: unknown): Promise<string> {
        return "done";
      }
    }

    const metadata: TaskMetadata = {
      name: "manual-task",
      target: TestTaskHandler,
      methodName: "handle",
    };

    const registry = new TaskRegistry();
    registry.register("manual-task", TestTaskHandler, "handle", metadata);

    expect(registry.has("manual-task")).toBe(true);
  });

  it("should retrieve registered task", () => {
    class TestTaskHandler {
      async process(_payload: unknown): Promise<void> {}
    }

    const metadata: TaskMetadata = {
      name: "retrievable-task",
      target: TestTaskHandler,
      methodName: "process",
    };

    const registry = new TaskRegistry();
    registry.register("retrievable-task", TestTaskHandler, "process", metadata);

    const task = registry.get("retrievable-task");

    expect(task).not.toBeUndefined();
    expect(task?.name).toBe("retrievable-task");
    expect(task?.target).toBe(TestTaskHandler);
    expect(task?.methodName).toBe("process");
  });

  it("should throw when registering a duplicate task name manually", () => {
    class FirstHandler {
      async handle(): Promise<void> {}
    }

    class SecondHandler {
      async handle(): Promise<void> {}
    }

    const registry = new TaskRegistry();
    registry.register("duplicate-task", FirstHandler, "handle", {
      name: "duplicate-task",
      target: FirstHandler,
      methodName: "handle",
    });

    expect(() =>
      registry.register("duplicate-task", SecondHandler, "handle", {
        name: "duplicate-task",
        target: SecondHandler,
        methodName: "handle",
      }),
    ).toThrow(DuplicateTaskRegistrationProblem);
  });

  it("should return undefined for non-existent task", () => {
    const task = new TaskRegistry().get("non-existent-task");
    expect(task).toBeUndefined();
  });

  it("should return all registered tasks", () => {
    class Handler1 {
      async task1(): Promise<void> {}
    }

    class Handler2 {
      async task2(): Promise<void> {}
    }

    const metadata1: TaskMetadata = { name: "task-1", target: Handler1, methodName: "task1" };
    const metadata2: TaskMetadata = { name: "task-2", target: Handler2, methodName: "task2" };

    const registry = new TaskRegistry();
    registry.register("task-1", Handler1, "task1", metadata1);
    registry.register("task-2", Handler2, "task2", metadata2);

    const allTasks = registry.getAll();

    expect(allTasks).toHaveLength(2);
    expect(allTasks.map((t) => t.name)).toContain("task-1");
    expect(allTasks.map((t) => t.name)).toContain("task-2");
  });

  it("should check if task exists", () => {
    class Handler {
      async work(): Promise<void> {}
    }

    const registry = new TaskRegistry();
    registry.register("work-task", Handler, "work", {
      name: "work-task",
      target: Handler,
      methodName: "work",
    });

    expect(registry.has("work-task")).toBe(true);
    expect(registry.has("non-existent")).toBe(false);
  });

  it("should collect tasks from MetadataStorage", () => {
    class TaskHandler {
      @Task({ name: "decorated-task" })
      async handle(): Promise<void> {}
    }

    expect(TaskHandler).toBeDefined();

    const registry = TaskRegistry.getInstance();
    registry.collectFromMetadata();

    expect(registry.has("decorated-task")).toBe(true);

    const task = registry.get("decorated-task");
    expect(task?.name).toBe("decorated-task");
  });

  it("should not duplicate existing tasks when collecting the same metadata twice", () => {
    class TaskHandler {
      @Task({ name: "existing-task" })
      async handle(): Promise<void> {}
    }

    expect(TaskHandler).toBeDefined();

    const registry = TaskRegistry.getInstance();

    registry.collectFromMetadata();
    registry.collectFromMetadata();

    const allTasks = registry.getAll();
    const existingTasks = allTasks.filter((t) => t.name === "existing-task");

    expect(existingTasks).toHaveLength(1);
  });

  it("should throw when creating registry from metadata with duplicate task names", () => {
    class FirstHandler {
      async handle(): Promise<void> {}
    }

    class SecondHandler {
      async handle(): Promise<void> {}
    }

    const firstMetadata: TaskMetadata = {
      name: "duplicate-bootstrap-task",
      target: FirstHandler,
      methodName: "handle",
    };
    const secondMetadata: TaskMetadata = {
      name: "duplicate-bootstrap-task",
      target: SecondHandler,
      methodName: "handle",
    };

    expect(() => TaskRegistry.fromMetadata([firstMetadata, secondMetadata])).toThrow(
      DuplicateTaskRegistrationProblem,
    );
  });

  it("should throw when constructing with different task registrations that share a name", () => {
    class FirstHandler {
      async handle(): Promise<void> {}
    }

    class SecondHandler {
      async handle(): Promise<void> {}
    }

    const firstMetadata: TaskMetadata = {
      name: "duplicate-constructor-task",
      target: FirstHandler,
      methodName: "handle",
    };
    const secondMetadata: TaskMetadata = {
      name: "duplicate-constructor-task",
      target: SecondHandler,
      methodName: "handle",
    };

    expect(
      () =>
        new TaskRegistry([
          {
            name: firstMetadata.name,
            target: FirstHandler,
            methodName: "handle",
            metadata: firstMetadata,
          },
          {
            name: secondMetadata.name,
            target: SecondHandler,
            methodName: "handle",
            metadata: secondMetadata,
          },
        ]),
    ).toThrow(DuplicateTaskRegistrationProblem);
  });

  it("should throw when collecting different metadata entries with the same task name", () => {
    class FirstHandler {
      @Task({ name: "duplicate-task" })
      async handle(): Promise<void> {}
    }

    class SecondHandler {
      @Task({ name: "duplicate-task" })
      async process(): Promise<void> {}
    }

    expect(FirstHandler).toBeDefined();
    expect(SecondHandler).toBeDefined();

    const registry = TaskRegistry.getInstance();

    expect(() => registry.collectFromMetadata()).toThrow(DuplicateTaskRegistrationProblem);
  });

  it("should throw when collecting the same handler and method with different task options", () => {
    class TaskHandler {
      async handle(): Promise<void> {}
    }

    const registry = new TaskRegistry();
    registry.register("option-sensitive-task", TaskHandler, "handle", {
      name: "option-sensitive-task",
      target: TaskHandler,
      methodName: "handle",
      options: {
        maxAttempts: 3,
        timeout: 1_000,
      },
    });

    expect(() =>
      registry.register("option-sensitive-task", TaskHandler, "handle", {
        name: "option-sensitive-task",
        target: TaskHandler,
        methodName: "handle",
        options: {
          maxAttempts: 5,
          timeout: 1_000,
        },
      }),
    ).toThrow(DuplicateTaskRegistrationProblem);
  });

  it("should allow collecting cloned metadata when task definition is identical", () => {
    class TaskHandler {
      async handle(): Promise<void> {}
    }

    const metadata: TaskMetadata = {
      name: "cloned-task",
      target: TaskHandler,
      methodName: "handle",
      options: {
        maxAttempts: 3,
        timeout: 1_000,
        idempotencyKey: "dedupe-key",
      },
    };

    const clonedMetadata: TaskMetadata = {
      name: metadata.name,
      target: metadata.target,
      methodName: metadata.methodName,
      options: {
        maxAttempts: metadata.options?.maxAttempts,
        timeout: metadata.options?.timeout,
        idempotencyKey: metadata.options?.idempotencyKey,
      },
    };

    const registry = TaskRegistry.fromMetadata([metadata, clonedMetadata]);

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get("cloned-task")?.metadata.options).toEqual(metadata.options);
  });

  it("should create a registry from provided metadata without global singleton state", () => {
    class TaskHandler {
      async handle(): Promise<void> {}
    }

    const metadata: TaskMetadata = {
      name: "bootstrap-task",
      target: TaskHandler,
      methodName: "handle",
    };

    const registry = TaskRegistry.fromMetadata([metadata]);

    expect(registry.has("bootstrap-task")).toBe(true);
    expect(TaskRegistry.getInstance().has("bootstrap-task")).toBe(false);
  });

  it("should reset all tasks", () => {
    class Handler {
      async task(): Promise<void> {}
    }

    const registry = new TaskRegistry();
    registry.register("task", Handler, "task", {
      name: "task",
      target: Handler,
      methodName: "task",
    });

    expect(registry.has("task")).toBe(true);

    registry.reset();

    expect(registry.has("task")).toBe(false);
    expect(registry.getAll()).toHaveLength(0);
  });
});

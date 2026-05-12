import { Container, MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { TASK_METADATA_KEY, Task } from "../libs/decorators/Task";
import type { TaskMetadata } from "../libs/types";

describe("@Task decorator", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("should register task metadata with default name", () => {
    class TestTaskHandler {
      @Task()
      async handleTask(payload: unknown): Promise<string> {
        return "done";
      }
    }

    const allMetadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY);
    expect(allMetadata).toHaveLength(1);

    const [metadata] = allMetadata;
    expect(metadata.value.name).toBe("TestTaskHandler.handleTask");
    expect(metadata.value.options).toEqual({});
    expect(metadata.value.methodName).toBe("handleTask");
  });

  it("should register task metadata with custom name", () => {
    class TestTaskHandler {
      @Task({ name: "custom-task-name" })
      async process(payload: unknown): Promise<string> {
        return "processed";
      }
    }

    const allMetadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY);
    expect(allMetadata).toHaveLength(1);

    const [metadata] = allMetadata;
    expect(metadata.value.name).toBe("custom-task-name");
  });

  it("should store task options", () => {
    class TestTaskHandler {
      @Task({
        name: "retryable-task",
        maxAttempts: 3,
        timeout: 5000,
        idempotencyKey: "unique-key",
      })
      async execute(payload: unknown): Promise<void> {
        // Task implementation
      }
    }

    const allMetadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY);
    const [metadata] = allMetadata;

    expect(metadata.value.options).toEqual({
      name: "retryable-task",
      maxAttempts: 3,
      timeout: 5000,
      idempotencyKey: "unique-key",
    });
  });

  it("should handle symbol method names", () => {
    const methodSymbol = Symbol("handler");

    class TestTaskHandler {
      @Task({ name: "symbol-task" })
      async [methodSymbol](payload: unknown): Promise<string> {
        return "symbol-handled";
      }
    }

    const allMetadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY);
    expect(allMetadata).toHaveLength(1);

    const [metadata] = allMetadata;
    expect(metadata.value.name).toBe("symbol-task");
    expect(metadata.value.methodName).toBe(methodSymbol);
  });

  it("should preserve original method behavior", async () => {
    class TestTaskHandler {
      @Task({ name: "echo-task" })
      async echo(payload: string): Promise<string> {
        return `echo: ${payload}`;
      }
    }

    const handler = new TestTaskHandler();
    const result = await handler.echo("hello");

    expect(result).toBe("echo: hello");
  });

  it("should support multiple tasks on the same class", () => {
    class MultiTaskHandler {
      @Task({ name: "task-1" })
      async task1(): Promise<string> {
        return "task1";
      }

      @Task({ name: "task-2" })
      async task2(): Promise<string> {
        return "task2";
      }

      @Task({ name: "task-3" })
      async task3(): Promise<string> {
        return "task3";
      }
    }

    const allMetadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY);
    expect(allMetadata).toHaveLength(3);

    const taskNames = allMetadata.map((m) => m.value.name);
    expect(taskNames).toContain("task-1");
    expect(taskNames).toContain("task-2");
    expect(taskNames).toContain("task-3");
  });
});

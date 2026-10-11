import { describe, expect, it } from "vitest";
import { ChunkExecutor, JobBuilder, Step } from "../index";
import type { ItemReader, ItemProcessor, ItemWriter } from "../index";
import type { ExecutionManager } from "@croco/execution-core";

type User = { id: string; name: string };
type UserDTO = { id: string; name: string };

function stubReader(): ItemReader<User> {
  return { read: async () => null };
}

function stubWriter(): ItemWriter<UserDTO> {
  return { write: async () => undefined };
}

describe("DocExamples", () => {
  it("package documentation example uses the real execution path", async () => {
    const reader = stubReader();
    const processor: ItemProcessor<User, UserDTO> = {
      process: async (user) => ({ id: user.id, name: user.name }),
    };
    const writer = stubWriter();
    const step = new Step({ name: "process-users", reader, processor, writer, chunkSize: 100 });
    const job = new JobBuilder("daily-batch").start(step).build();
    expect(job.steps).toHaveLength(1);
    expect(job.steps[0]).toBe(step);
  });

  it("ChunkExecutor documentation example constructs with an ExecutionManager", () => {
    const executionManager = {} as ExecutionManager;
    expect(() => new ChunkExecutor(executionManager)).not.toThrow();
  });

  it("JobBuilder documentation example builds steps without an execute method", () => {
    const job = new JobBuilder("daily-user-batch")
      .start(new Step({ name: "preprocess", reader: stubReader(), writer: stubWriter() }))
      .build();
    expect(job.steps).toHaveLength(1);
    expect("execute" in job).toBe(false);
  });
});

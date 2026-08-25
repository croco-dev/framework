import { describe, expect, it, vi } from "vitest";
import { JobBuilder } from "../libs/JobBuilder";
import {
  DuplicateBatchStepNameProblem,
  InvalidBatchStepNameProblem,
} from "../libs/problems/BatchStepProblems";
import { Step } from "../libs/Step";

function createStep(name: string): Step<unknown, unknown> {
  return new Step({
    name,
    reader: { read: vi.fn().mockResolvedValue(null) },
    writer: { write: vi.fn().mockResolvedValue(undefined) },
  });
}

describe("JobBuilder", () => {
  it.each(["", "   ", "\t\n"])("should reject a blank step name %j", (name) => {
    expect(() => createStep(name)).toThrow(InvalidBatchStepNameProblem);
    expect(() => createStep(name)).toThrow(
      expect.objectContaining({
        code: "batch-core/invalid-step-name",
        category: "ValidationError",
        extensions: { retryable: false, stepName: name },
      }),
    );
  });

  it("should reject duplicate step names only when the job is built", () => {
    const firstStep = createStep("sync-users");
    const read = vi.fn().mockResolvedValue(null);
    const write = vi.fn().mockResolvedValue(undefined);
    const duplicateStep = new Step({
      name: "sync-users",
      reader: { read },
      writer: { write },
    });
    const builder = new JobBuilder("daily").start(firstStep).next(duplicateStep);

    expect(() => builder.build()).toThrow(DuplicateBatchStepNameProblem);
    expect(() => builder.build()).toThrow(
      expect.objectContaining({
        code: "batch-core/duplicate-step-name",
        category: "ValidationError",
        extensions: { retryable: false, stepName: "sync-users" },
      }),
    );
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("should allow the same step instance in jobs without a name collision", () => {
    const step = createStep("sync-users");

    expect(new JobBuilder("daily").start(step).build().steps).toEqual([step]);
    expect(new JobBuilder("manual").start(step).build().steps).toEqual([step]);
  });

  it("should keep each build isolated from later builder changes and returned array mutations", () => {
    const firstStep = createStep("one");
    const secondStep = createStep("two");
    const builder = new JobBuilder("daily").start(firstStep);

    const firstJob = builder.build();
    builder.next(secondStep);
    const secondJob = builder.build();

    expect(firstJob.steps).toEqual([firstStep]);
    expect(secondJob.steps).toEqual([firstStep, secondStep]);
    expect(firstJob.steps[0]).toBe(firstStep);
    expect(secondJob.steps[0]).toBe(firstStep);
    expect(secondJob.steps[1]).toBe(secondStep);

    firstJob.steps.push(secondStep);

    expect(builder.build().steps).toEqual([firstStep, secondStep]);
    expect(secondJob.steps).toEqual([firstStep, secondStep]);
  });
});

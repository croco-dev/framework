import { describe, expect, it, vi } from "vitest";
import { JobBuilder } from "../libs/JobBuilder";
import { Step } from "../libs/Step";

function createStep(name: string): Step<unknown, unknown> {
  return new Step({
    name,
    reader: { read: vi.fn().mockResolvedValue(null) },
    writer: { write: vi.fn().mockResolvedValue(undefined) },
  });
}

describe("JobBuilder", () => {
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

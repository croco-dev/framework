import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";
import * as dataloader from "../index";
import { BatchLoaderImpl } from "../libs/BatchLoader";

describe("InvalidBatchLoaderConfigurationProblem", () => {
  it("exports the configuration Problem from the package entrypoint", () => {
    expect(dataloader).toHaveProperty("InvalidBatchLoaderConfigurationProblem");
  });

  it.each([0, -1, 1.5, NaN, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "reports invalid maxBatchSize %s as an RFC 7807 Problem",
    (maxBatchSize) => {
      const batchFn = vi.fn(async (keys: readonly number[]) => keys);
      let thrown: unknown;
      try {
        new BatchLoaderImpl({ name: "invalid", batchFn, maxBatchSize });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Problem);
      expect(batchFn).not.toHaveBeenCalled();
      if (!(thrown instanceof Problem)) {
        return;
      }
      expect(thrown.constructor).toBe(
        Reflect.get(dataloader, "InvalidBatchLoaderConfigurationProblem"),
      );
      expect(thrown.name).toBe("InvalidBatchLoaderConfigurationProblem");
      expect(thrown.category).toBe(ProblemCategory.InternalServerError);
      expect(thrown.toJSON()).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        code: "dataloader-core/invalid-configuration",
        detail: `Invalid BatchLoader configuration: maxBatchSize must be a positive safe integer or Infinity, got ${maxBatchSize}`,
      });
    },
  );
});

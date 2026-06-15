import { ProblemCategory } from "@croco/problems-core";
import {
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderFactoryResolutionProblem,
} from "@croco/repository-core";
import { describe, expect, it } from "vitest";

describe("BatchLoad Problem exports", () => {
  it("should expose BatchLoad Problem classes from the package root", () => {
    const notRegisteredProblem = new BatchLoaderFactoryNotRegisteredProblem();
    const resolutionProblem = new BatchLoaderFactoryResolutionProblem("Container lookup failed");

    expect(notRegisteredProblem.code).toBe("repository-core/batch-loader-factory-not-registered");
    expect(notRegisteredProblem.category).toBe(ProblemCategory.InternalServerError);
    expect(resolutionProblem.code).toBe("repository-core/batch-loader-factory-resolution-failed");
    expect(resolutionProblem.category).toBe(ProblemCategory.InternalServerError);
  });
});

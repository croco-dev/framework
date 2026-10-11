import type { SourceLocation } from "./types";
import { Problem, ProblemCategory } from "@croco/problems-core";

export class DataConfigProblem extends Problem {
  readonly code = "warehouse-tooling/invalid-config";
  readonly category = ProblemCategory.ValidationError;
  constructor(
    readonly reason: string,
    detail: string,
    readonly location?: SourceLocation,
  ) {
    super(undefined, undefined, detail, {
      extensions: { reason, ...(location ? { location } : {}) },
    });
  }
}

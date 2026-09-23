import { Problem, ProblemCategory } from "@croco/problems-core";
import type { DependencyResolutionTrace } from "../types";

export type ContainerResolutionFailureReason =
  | "missing-provider"
  | "construction-failed"
  | "scope-mismatch";

export class ContainerResolutionProblem extends Problem {
  readonly code = "framework-context/di-resolution-failed";
  readonly category = ProblemCategory.InternalServerError;
  readonly reason: ContainerResolutionFailureReason;
  readonly trace: DependencyResolutionTrace;

  constructor(
    detail: string,
    trace: DependencyResolutionTrace,
    reason: ContainerResolutionFailureReason,
    cause?: Error,
  ) {
    super("framework-context/di-resolution-failed", ProblemCategory.InternalServerError, detail, {
      cause,
      extensions: { reason, resolution: trace },
    });
    this.reason = reason;
    this.trace = trace;
  }
}

export class ContainerScopeMismatchProblem extends Problem {
  readonly code = "framework-context/di-scope-mismatch";
  readonly category = ProblemCategory.InternalServerError;
  readonly trace: DependencyResolutionTrace;

  constructor(
    singleton: string,
    dependency: string,
    path: readonly string[],
    trace: DependencyResolutionTrace,
    dependencyScope: "request" | "transient" = "request",
  ) {
    super(
      "framework-context/di-scope-mismatch",
      ProblemCategory.InternalServerError,
      `Singleton-scoped component ${singleton} cannot depend on ${dependencyScope}-scoped component ${dependency}. Resolution path: ${path.join(" -> ")}.`,
      {
        extensions: {
          reason: "scope-mismatch",
          resolution: trace,
          singleton,
          ...(dependencyScope === "request"
            ? { requestScoped: dependency }
            : { transientScoped: dependency }),
          path,
        },
      },
    );
    this.trace = trace;
  }
}
